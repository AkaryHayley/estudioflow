/* ==========================================
   EstudioFlow JS - Sincronización Firebase COMPLETA
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // VERIFICAR FIREBASE
    // -------------------------------------------------------------
    let db = window.db || null;
    let firestoreAvailable = !!db;
    let isSyncing = false;
    
    console.log('Firestore disponible:', firestoreAvailable);
    
    // Helper functions
    const loadState = (key, defaultValue) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    };
    const saveState = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };
    
    const addTerminalLine = (type, text) => {
        const terminalOutput = document.getElementById('terminal-output');
        if (!terminalOutput) return;
        const line = document.createElement('div');
        line.className = 'terminal-line';
        if (type === 'system') {
            line.innerHTML = `<span style="color: #a855f7;">[Sistema]</span> ${text}`;
        } else {
            line.innerHTML = text;
        }
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    };

    // -------------------------------------------------------------
    // DATE & TIME
    // -------------------------------------------------------------
    const dateSpan = document.getElementById('current-date');
    if (dateSpan) {
        dateSpan.textContent = new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // -------------------------------------------------------------
    // TASK MANAGER
    // -------------------------------------------------------------
    let tasks = loadState('tasks-list', [
        { id: 1, title: 'Instalar Visual Studio Code', priority: 'high', completed: true },
        { id: 2, title: 'Estructurar EstudioFlow', priority: 'medium', completed: false },
        { id: 3, title: 'Completar pomodoro', priority: 'low', completed: false }
    ]);

    const taskListEl = document.getElementById('task-list');
    const inputTaskTitle = document.getElementById('new-task-title');
    const selectTaskPriority = document.getElementById('new-task-priority');
    const btnAddTask = document.getElementById('btn-add-task');
    const statPendingTasksEl = document.getElementById('stat-pending-tasks');

    const escapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    };

    const updateStats = () => {
        if (statPendingTasksEl) {
            statPendingTasksEl.textContent = tasks.filter(t => !t.completed).length;
        }
    };

    const renderTasks = () => {
        if (!taskListEl) return;
        taskListEl.innerHTML = '';
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.dataset.id = task.id;
            li.innerHTML = `
                <div class="task-left">
                    <button class="task-checkbox"><i class="fa-solid fa-check"></i></button>
                    <div class="task-content">
                        <span class="task-title">${escapeHTML(task.title)}</span>
                        <span class="task-priority-tag priority-${task.priority}">${task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}</span>
                    </div>
                </div>
                <button class="btn-delete-task"><i class="fa-solid fa-trash-can"></i></button>
            `;
            li.querySelector('.task-checkbox').addEventListener('click', () => toggleTask(task.id));
            li.querySelector('.btn-delete-task').addEventListener('click', () => deleteTask(task.id));
            taskListEl.appendChild(li);
        });
        updateStats();
    };

    const toggleTask = (id) => {
        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveState('tasks-list', tasks);
        renderTasks();
        if (firestoreAvailable) {
            db.collection('estudioflow').doc('tasks').set({ tasks }, { merge: true });
        }
    };

    const deleteTask = (id) => {
        tasks = tasks.filter(t => t.id !== id);
        saveState('tasks-list', tasks);
        renderTasks();
        if (firestoreAvailable) {
            db.collection('estudioflow').doc('tasks').set({ tasks }, { merge: true });
        }
    };

    const addTask = () => {
        if (!inputTaskTitle) return;
        const title = inputTaskTitle.value.trim();
        if (!title) return;
        const priority = selectTaskPriority ? selectTaskPriority.value : 'medium';
        tasks.push({ id: Date.now(), title, priority, completed: false });
        saveState('tasks-list', tasks);
        renderTasks();
        if (firestoreAvailable) {
            db.collection('estudioflow').doc('tasks').set({ tasks }, { merge: true });
        }
        inputTaskTitle.value = '';
        addTerminalLine('system', `📝 Tarea añadida: "${title}"`);
    };

    if (btnAddTask) btnAddTask.addEventListener('click', addTask);
    if (inputTaskTitle) {
        inputTaskTitle.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask();
        });
    }

    renderTasks();

    // Suscribir tareas a Firebase
    if (firestoreAvailable) {
        db.collection('estudioflow').doc('tasks').onSnapshot((doc) => {
            if (doc.exists && !isSyncing) {
                const data = doc.data();
                if (data.tasks) {
                    isSyncing = true;
                    tasks = data.tasks;
                    saveState('tasks-list', tasks);
                    renderTasks();
                    addTerminalLine('system', '☁️ Tareas sincronizadas');
                    isSyncing = false;
                }
            }
        });
    }

    // -------------------------------------------------------------
    // SISTEMA DE NOTAS CON SINCRONIZACIÓN EN TIEMPO REAL
    // -------------------------------------------------------------
    let notebooks = [];
    let activeNotebookId = null;

    const notebooksListEl = document.getElementById('notebooks-list');
    const btnCreateNotebook = document.getElementById('btn-add-notebook');
    const activeTitleInput = document.getElementById('active-notebook-title');
    const noteArea = document.getElementById('quick-note');
    const btnSaveNote = document.getElementById('btn-save-note');
    const btnClearNote = document.getElementById('btn-clear-note');
    const autosaveStatus = document.getElementById('autosave-status');
    const syncStatusSpan = document.getElementById('sync-status');

    const updateSyncStatus = (status) => {
        if (!syncStatusSpan) return;
        if (status === 'synced') {
            syncStatusSpan.innerHTML = '<i class="fa-solid fa-cloud"></i> Sincronizado';
            syncStatusSpan.style.color = '#34d399';
        } else if (status === 'syncing') {
            syncStatusSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
            syncStatusSpan.style.color = '#fbbf24';
        } else if (status === 'offline') {
            syncStatusSpan.innerHTML = '<i class="fa-solid fa-cloud-slash"></i> Offline';
            syncStatusSpan.style.color = '#f87171';
        }
    };

    // Guardar notebooks en Firebase
    const saveNotebooksToFirebase = async () => {
        if (!firestoreAvailable || isSyncing) return;
        updateSyncStatus('syncing');
        try {
            await db.collection('estudioflow').doc('notebooks').set({
                notebooks: notebooks,
                activeNotebookId: activeNotebookId,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            updateSyncStatus('synced');
            if (autosaveStatus) {
                autosaveStatus.textContent = "✓ Sincronizado";
                setTimeout(() => {
                    if (autosaveStatus) autosaveStatus.textContent = "Listo";
                }, 1500);
            }
        } catch (error) {
            console.error('Error saving notebooks:', error);
            updateSyncStatus('offline');
        }
    };

    // Cargar notebooks desde localStorage
    const loadNotebooksFromLocal = () => {
        const localNotebooks = loadState('studyflow-notebooks-list', null);
        const defaultNotebooks = [
            { id: "nb-prog", title: "💻 Programación", content: "" },
            { id: "nb-db", title: "🗄️ Bases de Datos", content: "" },
            { id: "nb-sys", title: "🌐 Redes y Sistemas", content: "" }
        ];
        
        if (localNotebooks && localNotebooks.length > 0) {
            notebooks = localNotebooks;
            activeNotebookId = localStorage.getItem('studyflow-active-notebook-id') || notebooks[0]?.id;
        } else {
            notebooks = defaultNotebooks;
            activeNotebookId = 'nb-prog';
            saveState('studyflow-notebooks-list', notebooks);
            localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
        }
    };

    // Guardar contenido actual
    const saveCurrentNotebookContent = async () => {
        const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
        if (activeNb && noteArea && activeNb.content !== noteArea.value) {
            activeNb.content = noteArea.value;
            saveState('studyflow-notebooks-list', notebooks);
            if (firestoreAvailable) {
                await saveNotebooksToFirebase();
            }
            return true;
        }
        return false;
    };

    // Cargar cuaderno activo
    const loadActiveNotebook = () => {
        const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
        if (activeNb && noteArea) {
            if (noteArea.value !== activeNb.content) {
                noteArea.value = activeNb.content || '';
            }
        }
        if (activeTitleInput && activeNb) {
            activeTitleInput.value = activeNb.title;
        }
    };

    // Autosave
    let autosaveTimeout = null;
    const triggerAutosave = () => {
        if (autosaveStatus) autosaveStatus.textContent = "Guardando...";
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(async () => {
            await saveCurrentNotebookContent();
            if (autosaveStatus) {
                autosaveStatus.textContent = "✓ Guardado";
                setTimeout(() => {
                    if (autosaveStatus && autosaveStatus.textContent === "✓ Guardado") {
                        autosaveStatus.textContent = "Listo";
                    }
                }, 1000);
            }
        }, 800);
    };

    // Renderizar sidebar de cuadernos
    const renderNotebooksSidebar = () => {
        if (!notebooksListEl) return;
        notebooksListEl.innerHTML = '';
        
        notebooks.forEach(nb => {
            const li = document.createElement('li');
            li.className = `notebook-item ${nb.id === activeNotebookId ? 'active' : ''}`;
            li.dataset.id = nb.id;
            li.innerHTML = `<span class="notebook-item-title">${escapeHTML(nb.title)}</span>`;
            
            const isDefault = ['nb-prog', 'nb-db', 'nb-sys'].includes(nb.id);
            if (!isDefault) {
                const btnDelete = document.createElement('button');
                btnDelete.className = 'btn-delete-notebook';
                btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                btnDelete.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Borrar "${nb.title}"?`)) {
                        notebooks = notebooks.filter(item => item.id !== nb.id);
                        if (activeNotebookId === nb.id) {
                            activeNotebookId = notebooks[0]?.id || 'nb-prog';
                        }
                        saveState('studyflow-notebooks-list', notebooks);
                        localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
                        if (firestoreAvailable) await saveNotebooksToFirebase();
                        renderNotebooksSidebar();
                        loadActiveNotebook();
                        addTerminalLine('system', `📓 Cuaderno eliminado: "${nb.title}"`);
                    }
                });
                li.appendChild(btnDelete);
            }
            
            li.addEventListener('click', async () => {
                if (activeNotebookId === nb.id) return;
                await saveCurrentNotebookContent();
                activeNotebookId = nb.id;
                localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
                if (firestoreAvailable) await saveNotebooksToFirebase();
                renderNotebooksSidebar();
                loadActiveNotebook();
            });
            
            notebooksListEl.appendChild(li);
        });
    };

    // Event listeners para notas
    if (noteArea) {
        noteArea.addEventListener('input', triggerAutosave);
    }
    
    if (activeTitleInput) {
        activeTitleInput.addEventListener('input', async () => {
            const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
            if (activeNb && activeNb.title !== activeTitleInput.value) {
                activeNb.title = activeTitleInput.value;
                saveState('studyflow-notebooks-list', notebooks);
                if (firestoreAvailable) await saveNotebooksToFirebase();
                renderNotebooksSidebar();
            }
        });
    }

    if (btnSaveNote) {
        btnSaveNote.addEventListener('click', async () => {
            await saveCurrentNotebookContent();
            btnSaveNote.innerHTML = '<i class="fa-solid fa-check"></i> Guardado!';
            setTimeout(() => {
                btnSaveNote.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
            }, 1500);
            addTerminalLine('system', '📝 Notas guardadas y sincronizadas');
        });
    }

    if (btnClearNote && noteArea) {
        btnClearNote.addEventListener('click', async () => {
            const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
            if (confirm(`¿Borrar todos los apuntes de "${activeNb?.title}"?`)) {
                noteArea.value = '';
                await saveCurrentNotebookContent();
                addTerminalLine('system', `📓 Apuntes borrados de "${activeNb?.title}"`);
            }
        });
    }

    if (btnCreateNotebook) {
        btnCreateNotebook.addEventListener('click', async () => {
            const name = prompt('Nombre del nuevo cuaderno:', 'Nuevo Cuaderno');
            if (!name) return;
            const newId = 'nb-' + Date.now();
            notebooks.push({ id: newId, title: name.trim(), content: '' });
            activeNotebookId = newId;
            saveState('studyflow-notebooks-list', notebooks);
            localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
            if (firestoreAvailable) await saveNotebooksToFirebase();
            renderNotebooksSidebar();
            loadActiveNotebook();
            addTerminalLine('system', `📓 Nuevo cuaderno creado: "${name}"`);
        });
    }

    // Inicializar notebooks
    loadNotebooksFromLocal();
    renderNotebooksSidebar();
    loadActiveNotebook();

    // Suscribir notebooks a Firebase (sincronización en tiempo real)
    if (firestoreAvailable) {
        db.collection('estudioflow').doc('notebooks').onSnapshot((doc) => {
            if (doc.exists && !isSyncing) {
                const data = doc.data();
                if (data.notebooks && JSON.stringify(notebooks) !== JSON.stringify(data.notebooks)) {
                    isSyncing = true;
                    notebooks = data.notebooks;
                    activeNotebookId = data.activeNotebookId;
                    saveState('studyflow-notebooks-list', notebooks);
                    localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
                    renderNotebooksSidebar();
                    loadActiveNotebook();
                    addTerminalLine('system', '☁️ Notas sincronizadas desde la nube');
                    isSyncing = false;
                }
            } else if (!doc.exists && notebooks.length > 0) {
                // Primera vez - subir datos locales
                saveNotebooksToFirebase();
            }
        }, (error) => {
            console.error('Firestore error:', error);
            updateSyncStatus('offline');
        });
    }

    // Mensaje de bienvenida
    setTimeout(() => {
        if (firestoreAvailable) {
            addTerminalLine('system', '🎉 ¡Sincronización en tiempo real activa! Tus notas se actualizan entre dispositivos');
        } else {
            addTerminalLine('system', '📁 Modo local - Firebase no conectado');
        }
    }, 1000);

    // -------------------------------------------------------------
    // TABS NAVIGATION
    // -------------------------------------------------------------
    const navDashboard = document.getElementById('nav-dashboard');
    const navTasks = document.getElementById('nav-tasks');
    const navTimer = document.getElementById('nav-timer');
    const navNotes = document.getElementById('nav-notes');
    const navRoutines = document.getElementById('nav-routines');
    const sectionDashboard = document.getElementById('section-dashboard');
    const sectionRoutines = document.getElementById('section-routines');
    const sectionNotes = document.getElementById('section-notes');

    const showSection = (section) => {
        if (sectionDashboard) sectionDashboard.classList.add('hidden');
        if (sectionRoutines) sectionRoutines.classList.add('hidden');
        if (sectionNotes) sectionNotes.classList.add('hidden');
        if (section === 'dashboard' && sectionDashboard) sectionDashboard.classList.remove('hidden');
        else if (section === 'routines' && sectionRoutines) sectionRoutines.classList.remove('hidden');
        else if (section === 'notes' && sectionNotes) sectionNotes.classList.remove('hidden');
    };

    const setActiveNav = (activeNav) => {
        [navDashboard, navTasks, navTimer, navNotes, navRoutines].forEach(nav => {
            if (nav) nav.classList.remove('active');
        });
        if (activeNav) activeNav.classList.add('active');
    };

    if (navDashboard) navDashboard.addEventListener('click', (e) => {
        e.preventDefault(); setActiveNav(navDashboard); showSection('dashboard');
    });
    if (navNotes) navNotes.addEventListener('click', (e) => {
        e.preventDefault(); setActiveNav(navNotes); showSection('notes');
    });
    if (navTasks) navTasks.addEventListener('click', (e) => {
        e.preventDefault(); setActiveNav(navTasks); showSection('dashboard');
        document.querySelector('.widget-tasks')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (navTimer) navTimer.addEventListener('click', (e) => {
        e.preventDefault(); setActiveNav(navTimer); showSection('dashboard');
        document.querySelector('.widget-pomodoro')?.scrollIntoView({ behavior: 'smooth' });
    });
    if (navRoutines) navRoutines.addEventListener('click', (e) => {
        e.preventDefault(); setActiveNav(navRoutines); showSection('routines');
    });

    // -------------------------------------------------------------
    // POMODORO TIMER (versión simplificada)
    // -------------------------------------------------------------
    let timerInterval = null;
    let totalSeconds = 1500;
    let secondsLeft = 1500;
    let timerRunning = false;
    let completedPomodoros = loadState('completed-pomodoros', 0);

    const timeLeftEl = document.getElementById('time-left');
    const timerProgressEl = document.getElementById('timer-progress');
    const timerStatusEl = document.getElementById('timer-status');
    const btnTimerStart = document.getElementById('btn-timer-start');
    const btnTimerPause = document.getElementById('btn-timer-pause');
    const btnTimerReset = document.getElementById('btn-timer-reset');
    const statPomodorosEl = document.getElementById('stat-completed-pomodoros');
    const bellSound = document.getElementById('bell-sound');

    if (statPomodorosEl) statPomodorosEl.textContent = completedPomodoros;

    const updateTimerDisplay = () => {
        if (!timeLeftEl) return;
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        timeLeftEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startTimer = () => {
        if (timerRunning) return;
        timerRunning = true;
        if (btnTimerStart) btnTimerStart.disabled = true;
        if (btnTimerPause) btnTimerPause.disabled = false;
        timerInterval = setInterval(() => {
            if (secondsLeft > 0) {
                secondsLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                if (bellSound) bellSound.play();
                if (totalSeconds === 1500) {
                    completedPomodoros++;
                    if (statPomodorosEl) statPomodorosEl.textContent = completedPomodoros;
                    saveState('completed-pomodoros', completedPomodoros);
                    addTerminalLine('system', '✅ Pomodoro completado!');
                }
                resetTimer();
            }
        }, 1000);
    };

    const pauseTimer = () => {
        if (!timerRunning) return;
        timerRunning = false;
        clearInterval(timerInterval);
        if (btnTimerStart) btnTimerStart.disabled = false;
        if (btnTimerPause) btnTimerPause.disabled = true;
    };

    const resetTimer = () => {
        pauseTimer();
        secondsLeft = totalSeconds;
        updateTimerDisplay();
        if (btnTimerPause) btnTimerPause.disabled = true;
    };

    if (btnTimerStart) btnTimerStart.addEventListener('click', startTimer);
    if (btnTimerPause) btnTimerPause.addEventListener('click', pauseTimer);
    if (btnTimerReset) btnTimerReset.addEventListener('click', resetTimer);

    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            totalSeconds = parseInt(btn.dataset.time, 10);
            secondsLeft = totalSeconds;
            if (timerStatusEl) {
                if (totalSeconds === 1500) timerStatusEl.textContent = "Foco";
                else if (totalSeconds === 300) timerStatusEl.textContent = "Corto";
                else timerStatusEl.textContent = "Largo";
            }
            resetTimer();
        });
    });

    const customMinutesInput = document.getElementById('custom-minutes');
    const btnSetCustom = document.getElementById('btn-set-custom');
    if (btnSetCustom && customMinutesInput) {
        btnSetCustom.addEventListener('click', () => {
            const mins = parseInt(customMinutesInput.value, 10);
            if (isNaN(mins) || mins < 1 || mins > 180) {
                alert('Minutos válidos: 1-180');
                return;
            }
            presetBtns.forEach(b => b.classList.remove('active'));
            totalSeconds = mins * 60;
            secondsLeft = totalSeconds;
            if (timerStatusEl) timerStatusEl.textContent = `${mins}m`;
            resetTimer();
        });
    }

    resetTimer();

    const btnCloseModal = document.getElementById('btn-close-modal');
    const alarmModal = document.getElementById('alarm-modal');
    if (btnCloseModal && alarmModal) {
        btnCloseModal.addEventListener('click', () => {
            alarmModal.classList.add('hidden');
            if (bellSound) {
                bellSound.pause();
                bellSound.currentTime = 0;
            }
        });
    }

    // -------------------------------------------------------------
    // TERMINAL COMMANDS
    // -------------------------------------------------------------
    const terminalInput = document.getElementById('terminal-input');
    if (terminalInput) {
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const cmd = terminalInput.value.trim().toLowerCase();
                if (cmd) {
                    addTerminalLine('input', cmd);
                    if (cmd === 'help') {
                        addTerminalLine('output', 'Comandos: help, clear, date, todo');
                    } else if (cmd === 'clear') {
                        const terminalOut = document.getElementById('terminal-output');
                        if (terminalOut) terminalOut.innerHTML = '';
                    } else if (cmd === 'date') {
                        addTerminalLine('output', new Date().toString());
                    } else if (cmd === 'todo') {
                        const pending = tasks.filter(t => !t.completed);
                        if (pending.length === 0) addTerminalLine('output', 'No hay tareas pendientes');
                        else pending.forEach(t => addTerminalLine('output', `- ${t.title}`));
                    } else {
                        addTerminalLine('output', `Comando no reconocido: ${cmd}`);
                    }
                    terminalInput.value = '';
                }
            }
        });
    }

    // -------------------------------------------------------------
    // LOFI PLAYER SIMPLIFICADO
    // -------------------------------------------------------------
    const lofiAudio = document.getElementById('lofi-audio');
    const btnLofiPlay = document.getElementById('btn-lofi-play');
    const lofiSelect = document.getElementById('lofi-station-select');
    const lofiVolume = document.getElementById('lofi-volume');
    const lofiStatus = document.getElementById('lofi-status');
    let isLofiPlaying = false;

    if (lofiAudio && btnLofiPlay) {
        if (lofiVolume) lofiAudio.volume = parseFloat(lofiVolume.value);
        const playLofi = () => {
            if (isLofiPlaying) return;
            if (lofiSelect) lofiAudio.src = lofiSelect.value;
            lofiAudio.load();
            lofiAudio.play().then(() => {
                isLofiPlaying = true;
                btnLofiPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
                if (lofiStatus) lofiStatus.textContent = 'Online';
            }).catch(() => {});
        };
        const stopLofi = () => {
            lofiAudio.pause();
            isLofiPlaying = false;
            btnLofiPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            if (lofiStatus) lofiStatus.textContent = 'Offline';
        };
        btnLofiPlay.addEventListener('click', () => isLofiPlaying ? stopLofi() : playLofi());
        if (lofiVolume) lofiVolume.addEventListener('input', (e) => lofiAudio.volume = e.target.value);
        if (lofiSelect) lofiSelect.addEventListener('change', () => { if (isLofiPlaying) { stopLofi(); setTimeout(playLofi, 100); } });
    }
});
