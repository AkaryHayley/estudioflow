/* ==========================================
   EstudioFlow JS - Core Functionality
   Contains Pomodoro, Task List, Quick Notes,
   and Terminal Simulator.
   WITH FULL FIREBASE REAL-TIME SYNC
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. DATE & TIME INITIALIZATION
    // -------------------------------------------------------------
    const dateSpan = document.getElementById('current-date');
    const updateHeaderDate = () => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        dateSpan.textContent = today.toLocaleDateString('es-ES', options);
    };
    updateHeaderDate();

    // -------------------------------------------------------------
    // 2. STATE MANAGEMENT (localStorage Helper)
    // -------------------------------------------------------------
    const loadState = (key, defaultValue) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    };
    const saveState = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };

    // -------------------------------------------------------------
    // 2.5 FIREBASE REAL-TIME SYSTEM
    // -------------------------------------------------------------
    let firestoreAvailable = typeof window.firestoreAvailable !== 'undefined' && window.firestoreAvailable;
    let db = window.db || null;
    let isSyncing = false;
    let firebaseUnsubscribes = [];
    
    const syncToFirebase = async (collectionName, docId, data) => {
        if (!firestoreAvailable || !db || isSyncing) return false;
        try {
            const { doc, setDoc } = await import("firebase/firestore");
            const docRef = doc(db, collectionName, docId);
            await setDoc(docRef, {
                ...data,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error(`Error syncing ${collectionName}:`, error);
            return false;
        }
    };
    
    const subscribeToFirebase = (collectionName, docId, callback) => {
        if (!firestoreAvailable || !db) return null;
        try {
            import("firebase/firestore").then(({ doc, onSnapshot }) => {
                const docRef = doc(db, collectionName, docId);
                const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
                    if (docSnapshot.exists() && !isSyncing) {
                        callback(docSnapshot.data());
                    }
                }, (error) => {
                    console.error(`Error in ${collectionName} subscription:`, error);
                });
                firebaseUnsubscribes.push(unsubscribe);
                return unsubscribe;
            });
        } catch (error) {
            console.error(`Error subscribing to ${collectionName}:`, error);
            return null;
        }
    };

    // -------------------------------------------------------------
    // 3. POMODORO TIMER WORKER
    // -------------------------------------------------------------
    let timerInterval = null;
    let totalSeconds = 1500;
    let secondsLeft = 1500;
    let isRunning = false;
    let completedPomodoros = loadState('completed-pomodoros', 0);

    const timeLeftEl = document.getElementById('time-left');
    const timerProgressEl = document.getElementById('timer-progress');
    const timerStatusEl = document.getElementById('timer-status');
    const btnStart = document.getElementById('btn-timer-start');
    const btnPause = document.getElementById('btn-timer-pause');
    const btnReset = document.getElementById('btn-timer-reset');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const statPomodorosEl = document.getElementById('stat-completed-pomodoros');
    const bellSound = document.getElementById('bell-sound');
    let audioContext = null;
    let oscillatorNode = null;
    let beepTimeoutId = null;

    const stopAlertSound = () => {
        if (oscillatorNode) {
            oscillatorNode.stop();
            oscillatorNode.disconnect();
            oscillatorNode = null;
        }
        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }
        if (beepTimeoutId) {
            clearTimeout(beepTimeoutId);
            beepTimeoutId = null;
        }
    };

    const radius = 85;
    const circumference = 2 * Math.PI * radius;
    timerProgressEl.style.strokeDasharray = circumference;
    timerProgressEl.style.strokeDashoffset = circumference;

    const setProgress = (percent) => {
        const offset = circumference - (percent / 100) * circumference;
        timerProgressEl.style.strokeDashoffset = offset;
    };

    const updateTimerDisplay = () => {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        timeLeftEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        const percent = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
        setProgress(percent);
    };

    const startTimer = () => {
        if (isRunning) return;
        isRunning = true;
        btnStart.disabled = true;
        btnPause.disabled = false;
        
        timerInterval = setInterval(() => {
            if (secondsLeft > 0) {
                secondsLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                playAlertSound();
                handleTimerFinished();
            }
        }, 1000);
    };

    const pauseTimer = () => {
        if (!isRunning) return;
        isRunning = false;
        clearInterval(timerInterval);
        btnStart.disabled = false;
        btnPause.disabled = true;
    };

    const resetTimer = () => {
        pauseTimer();
        secondsLeft = totalSeconds;
        updateTimerDisplay();
        btnPause.disabled = true;
    };

    const playAlertSound = () => {
        stopAlertSound();
        if (bellSound && bellSound.src) {
            bellSound.currentTime = 0;
            bellSound.loop = true;
            bellSound.play().catch(e => console.log('Audio playback interaction restriction:', e));
            return;
        }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContext = new AudioCtx();
        oscillatorNode = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillatorNode.type = 'sine';
        oscillatorNode.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        oscillatorNode.connect(gain);
        gain.connect(audioContext.destination);
        oscillatorNode.start();
        beepTimeoutId = setTimeout(() => {
            stopAlertSound();
        }, 1200);
    };

    const handleTimerFinished = () => {
        isRunning = false;
        btnStart.disabled = false;
        btnPause.disabled = true;
        if (totalSeconds === 1500) {
            completedPomodoros++;
            saveState('completed-pomodoros', completedPomodoros);
            statPomodorosEl.textContent = completedPomodoros;
            syncToFirebase('estudioflow', 'pomodoro_stats', { completedPomodoros });
            addTerminalLine('system', '¡Pomodoro completado! Gran trabajo enfocándote. Tómate un recreo.');
        } else {
            addTerminalLine('system', 'Recreo finalizado. ¡Es hora de volver al código!');
        }
        const alarmModal = document.getElementById('alarm-modal');
        if (alarmModal) alarmModal.classList.remove('hidden');
        playAlertSound();
        resetTimer();
    };

    presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const time = parseInt(btn.dataset.time, 10);
            totalSeconds = time;
            secondsLeft = time;
            if (time === 1500) timerStatusEl.textContent = "Foco";
            else if (time === 300) timerStatusEl.textContent = "Corto";
            else timerStatusEl.textContent = "Largo";
            resetTimer();
        });
    });

    btnStart.addEventListener('click', startTimer);
    btnPause.addEventListener('click', pauseTimer);
    btnReset.addEventListener('click', resetTimer);

    const customMinutesInput = document.getElementById('custom-minutes');
    const btnSetCustom = document.getElementById('btn-set-custom');

    if (btnSetCustom && customMinutesInput) {
        btnSetCustom.addEventListener('click', () => {
            const mins = parseInt(customMinutesInput.value, 10);
            if (isNaN(mins) || mins < 1 || mins > 180) {
                alert('Por favor, introduce un número válido de minutos entre 1 y 180. 🎀');
                return;
            }
            presetBtns.forEach(b => b.classList.remove('active'));
            totalSeconds = mins * 60;
            secondsLeft = totalSeconds;
            timerStatusEl.textContent = `Personalizado (${mins}m)`;
            resetTimer();
            addTerminalLine('system', `Cronómetro configurado en modo personalizado: ${mins} minutos.`);
            const originalHtml = btnSetCustom.innerHTML;
            btnSetCustom.innerHTML = '<i class="fa-solid fa-check"></i>';
            btnSetCustom.style.background = 'var(--success)';
            setTimeout(() => {
                btnSetCustom.innerHTML = originalHtml;
                btnSetCustom.style.background = '';
            }, 1000);
        });
        customMinutesInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnSetCustom.click();
        });
    }

    const alarmModal = document.getElementById('alarm-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            if (alarmModal) alarmModal.classList.add('hidden');
            stopAlertSound();
            if (bellSound) {
                bellSound.pause();
                bellSound.loop = false;
                bellSound.currentTime = 0;
            }
            addTerminalLine('system', 'Alarma detenida. ¡A seguir con el flujo! 🤍');
        });
    }

    statPomodorosEl.textContent = completedPomodoros;
    resetTimer();

    // -------------------------------------------------------------
    // 4. TASK MANAGER (TO-DO LIST) CON SYNC
    // -------------------------------------------------------------
    let tasks = loadState('tasks-list', [
        { id: 1, title: 'Instalar Visual Studio Code y extensiones', priority: 'high', completed: true },
        { id: 2, title: 'Estructurar el espacio de trabajo EstudioFlow', priority: 'medium', completed: false },
        { id: 3, title: 'Completar primer bloque pomodoro enfocado', priority: 'low', completed: false }
    ]);

    const taskListEl = document.getElementById('task-list');
    const inputTaskTitle = document.getElementById('new-task-title');
    const selectTaskPriority = document.getElementById('new-task-priority');
    const btnAddTask = document.getElementById('btn-add-task');
    const statPendingTasksEl = document.getElementById('stat-pending-tasks');

    const updateStats = () => {
        const pendingCount = tasks.filter(t => !t.completed).length;
        statPendingTasksEl.textContent = pendingCount;
    };

    const syncTasks = () => {
        syncToFirebase('estudioflow', 'tasks', { tasks });
    };

    const renderTasks = () => {
        taskListEl.innerHTML = '';
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.dataset.id = task.id;
            li.innerHTML = `
                <div class="task-left">
                    <button class="task-checkbox" aria-label="Completar tarea">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <div class="task-content">
                        <span class="task-title">${escapeHTML(task.title)}</span>
                        <span class="task-priority-tag priority-${task.priority}">${task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}</span>
                    </div>
                </div>
                <button class="btn-delete-task" aria-label="Eliminar tarea">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            li.querySelector('.task-checkbox').addEventListener('click', () => toggleTask(task.id));
            li.querySelector('.btn-delete-task').addEventListener('click', () => deleteTask(task.id));
            taskListEl.appendChild(li);
        });
        updateStats();
        syncTasks();
    };

    const toggleTask = (id) => {
        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveState('tasks-list', tasks);
        renderTasks();
    };

    const deleteTask = (id) => {
        tasks = tasks.filter(t => t.id !== id);
        saveState('tasks-list', tasks);
        renderTasks();
    };

    const addTask = () => {
        const title = inputTaskTitle.value.trim();
        if (!title) return;
        const priority = selectTaskPriority.value;
        const newTask = { id: Date.now(), title, priority, completed: false };
        tasks.push(newTask);
        saveState('tasks-list', tasks);
        renderTasks();
        inputTaskTitle.value = '';
        addTerminalLine('system', `Tarea añadida: "${title}"`);
    };

    btnAddTask.addEventListener('click', addTask);
    inputTaskTitle.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

    const escapeHTML = (str) => {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    };

    renderTasks();
    
    // Suscribir tareas a Firebase
    subscribeToFirebase('estudioflow', 'tasks', (data) => {
        if (data.tasks && !isSyncing) {
            isSyncing = true;
            tasks = data.tasks;
            saveState('tasks-list', tasks);
            renderTasks();
            addTerminalLine('system', '☁️ Tareas sincronizadas desde la nube');
            isSyncing = false;
        }
    });

    // -------------------------------------------------------------
    // 5. SISTEMA DE NOTAS SINCRONIZADO CON FIREBASE (TIEMPO REAL)
    // -------------------------------------------------------------
    let notebooks = [];
    let activeNotebookId = null;
    let currentUnsubscribe = null;
    let lastSavedContent = '';

    const notebooksListEl = document.getElementById('notebooks-list');
    const btnCreateNotebook = document.getElementById('btn-add-notebook');
    const activeTitleInputNotes = document.getElementById('active-notebook-title');
    const noteArea = document.getElementById('quick-note');
    const btnSaveNote = document.getElementById('btn-save-note');
    const btnClearNote = document.getElementById('btn-clear-note');
    const autosaveStatus = document.getElementById('autosave-status');
    const syncStatusSpan = document.getElementById('sync-status');

    const updateSyncStatus = (status) => {
        if (!syncStatusSpan) return;
        if (status === 'synced') {
            syncStatusSpan.innerHTML = '<i class="fa-solid fa-cloud"></i> Sincronizado';
            syncStatusSpan.className = 'sync-status';
            if (autosaveStatus) autosaveStatus.textContent = "✓ Sincronizado";
        } else if (status === 'syncing') {
            syncStatusSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
            syncStatusSpan.className = 'sync-status syncing';
            if (autosaveStatus) autosaveStatus.textContent = "Sincronizando...";
        } else if (status === 'offline') {
            syncStatusSpan.innerHTML = '<i class="fa-solid fa-cloud-slash"></i> Offline (local)';
            syncStatusSpan.className = 'sync-status offline';
            if (autosaveStatus) autosaveStatus.textContent = "⚠️ Offline - Local";
        }
    };

    const saveNotebooksToFirebase = async () => {
        if (!firestoreAvailable || !db || isSyncing) return;
        try {
            updateSyncStatus('syncing');
            const { doc, setDoc } = await import("firebase/firestore");
            const docRef = doc(db, 'estudioflow', 'user_notebooks');
            await setDoc(docRef, {
                notebooks: notebooks,
                activeNotebookId: activeNotebookId,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            updateSyncStatus('synced');
        } catch (error) {
            console.error('Error saving notebooks:', error);
            updateSyncStatus('offline');
        }
    };

    const subscribeToNotebooks = () => {
        if (!firestoreAvailable || !db) {
            loadNotebooksFromLocal();
            return;
        }
        if (currentUnsubscribe) currentUnsubscribe();
        import("firebase/firestore").then(({ doc, onSnapshot }) => {
            const docRef = doc(db, 'estudioflow', 'user_notebooks');
            currentUnsubscribe = onSnapshot(docRef, (docSnapshot) => {
                if (docSnapshot.exists() && !isSyncing) {
                    const data = docSnapshot.data();
                    const remoteNotebooks = data.notebooks;
                    const remoteActiveId = data.activeNotebookId;
                    if (JSON.stringify(notebooks) !== JSON.stringify(remoteNotebooks)) {
                        isSyncing = true;
                        notebooks = remoteNotebooks;
                        activeNotebookId = remoteActiveId;
                        saveState('studyflow-notebooks-list', notebooks);
                        localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
                        renderNotebooksSidebar();
                        loadActiveNotebook();
                        addTerminalLine('system', '☁️ Notas sincronizadas desde la nube');
                        if (noteArea) {
                            noteArea.style.transition = 'background 0.3s';
                            noteArea.style.background = 'rgba(52, 211, 153, 0.1)';
                            setTimeout(() => { if(noteArea) noteArea.style.background = ''; }, 500);
                        }
                        isSyncing = false;
                    }
                } else if (!docSnapshot.exists()) {
                    saveNotebooksToFirebase();
                }
                updateSyncStatus('synced');
            }, (error) => {
                console.error('Firestore subscription error:', error);
                updateSyncStatus('offline');
            });
        });
    };

    const loadNotebooksFromLocal = () => {
        const localNotebooks = loadState('studyflow-notebooks-list', null);
        const defaultNotebooks = [
            { id: "nb-prog", title: "💻 Programación", content: "" },
            { id: "nb-db", title: "🗄️ Bases de Datos", content: "" },
            { id: "nb-sys", title: "🌐 Redes y Sistemas", content: "" }
        ];
        if (localNotebooks) {
            notebooks = localNotebooks;
            activeNotebookId = localStorage.getItem('studyflow-active-notebook-id') || 'nb-prog';
            if (!notebooks.find(nb => nb.id === activeNotebookId) && notebooks.length > 0) activeNotebookId = notebooks[0].id;
        } else {
            notebooks = defaultNotebooks;
            activeNotebookId = 'nb-prog';
            const oldNote = localStorage.getItem('studyflow-quick-note');
            if (oldNote) notebooks[0].content = oldNote;
            saveState('studyflow-notebooks-list', notebooks);
            localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
        }
    };

    const saveCurrentNotebookContent = async () => {
        const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
        if (activeNb && noteArea && activeNb.content !== noteArea.value) {
            activeNb.content = noteArea.value;
            saveState('studyflow-notebooks-list', notebooks);
            await saveNotebooksToFirebase();
        }
    };

    const loadActiveNotebook = () => {
        const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
        if (activeNb && noteArea) {
            noteArea.value = activeNb.content || '';
            lastSavedContent = activeNb.content || '';
        }
        if (activeTitleInputNotes) activeTitleInputNotes.value = activeNb ? activeNb.title : '';
    };

    let autosaveTimeoutNotes = null;
    const triggerAutosaveNotes = () => {
        if (autosaveStatus) {
            autosaveStatus.textContent = "Guardando...";
            autosaveStatus.classList.add('saving');
        }
        clearTimeout(autosaveTimeoutNotes);
        autosaveTimeoutNotes = setTimeout(async () => {
            await saveCurrentNotebookContent();
            if (autosaveStatus) {
                autosaveStatus.textContent = "✓ Todo guardado";
                autosaveStatus.classList.remove('saving');
            }
            setTimeout(() => {
                if (autosaveStatus && autosaveStatus.textContent === "✓ Todo guardado") autosaveStatus.textContent = "Listo";
            }, 1500);
        }, 800);
    };

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
                        if (activeNotebookId === nb.id) activeNotebookId = notebooks[0]?.id || 'nb-prog';
                        saveState('studyflow-notebooks-list', notebooks);
                        await saveNotebooksToFirebase();
                        renderNotebooksSidebar();
                        loadActiveNotebook();
                        addTerminalLine('system', `Cuaderno eliminado: "${nb.title}"`);
                    }
                });
                li.appendChild(btnDelete);
            }
            li.addEventListener('click', async () => {
                if (activeNotebookId === nb.id) return;
                await saveCurrentNotebookContent();
                activeNotebookId = nb.id;
                localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
                await saveNotebooksToFirebase();
                renderNotebooksSidebar();
                loadActiveNotebook();
            });
            notebooksListEl.appendChild(li);
        });
    };

    if (noteArea) noteArea.addEventListener('input', triggerAutosaveNotes);
    if (activeTitleInputNotes) {
        activeTitleInputNotes.addEventListener('input', async () => {
            const newTitle = activeTitleInputNotes.value.trim();
            if (!newTitle) return;
            const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
            if (activeNb && activeNb.title !== newTitle) {
                activeNb.title = newTitle;
                saveState('studyflow-notebooks-list', notebooks);
                await saveNotebooksToFirebase();
                renderNotebooksSidebar();
            }
        });
    }
    if (btnSaveNote) {
        btnSaveNote.addEventListener('click', async () => {
            await saveCurrentNotebookContent();
            btnSaveNote.innerHTML = '<i class="fa-solid fa-check"></i> ¡Guardado!';
            btnSaveNote.style.background = 'var(--success)';
            setTimeout(() => {
                btnSaveNote.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar 💾';
                btnSaveNote.style.background = '';
            }, 1500);
        });
    }
    if (btnClearNote && noteArea) {
        btnClearNote.addEventListener('click', async () => {
            const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
            if (confirm(`¿Borrar apuntes de "${activeNb?.title}"?`)) {
                noteArea.value = '';
                await saveCurrentNotebookContent();
                addTerminalLine('system', `Apuntes borrados de "${activeNb?.title}"`);
            }
        });
    }
    if (btnCreateNotebook) {
        btnCreateNotebook.addEventListener('click', async () => {
            const name = prompt('Nombre del nuevo cuaderno:', 'Nuevo Cuaderno ☁️');
            if (!name) return;
            const newId = 'nb-custom-' + Date.now();
            notebooks.push({ id: newId, title: name.trim(), content: '' });
            activeNotebookId = newId;
            saveState('studyflow-notebooks-list', notebooks);
            await saveNotebooksToFirebase();
            renderNotebooksSidebar();
            loadActiveNotebook();
            addTerminalLine('system', `Cuaderno creado: "${name}"`);
        });
    }

    loadNotebooksFromLocal();
    renderNotebooksSidebar();
    loadActiveNotebook();
    subscribeToNotebooks();

    // -------------------------------------------------------------
    // 6. SYSTEMS TERMINAL SIMULATOR
    // -------------------------------------------------------------
    const terminalInput = document.getElementById('terminal-input');
    const terminalOutput = document.getElementById('terminal-output');

    const addTerminalLine = (type, text) => {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        if (type === 'input') {
            line.innerHTML = `<span class="terminal-prompt">invitado@estudioflow:~$</span> ${escapeHTML(text)}`;
        } else if (type === 'system') {
            line.innerHTML = `<span style="color: #a855f7;">[Sistema]</span> ${escapeHTML(text)}`;
        } else {
            line.innerHTML = text;
        }
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    };

    const processCommand = (cmdText) => {
        const cleanCmd = cmdText.trim();
        if (!cleanCmd) return;
        addTerminalLine('input', cleanCmd);
        const parts = cleanCmd.split(' ');
        const baseCmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (baseCmd) {
            case 'help':
                addTerminalLine('output', `Comandos disponibles:<br>&nbsp;&nbsp;<span style="color: var(--primary);">help</span> - Ayuda<br>&nbsp;&nbsp;<span style="color: var(--primary);">clear</span> - Limpiar<br>&nbsp;&nbsp;<span style="color: var(--primary);">date</span> - Fecha/hora<br>&nbsp;&nbsp;<span style="color: var(--primary);">todo</span> - Tareas pendientes<br>&nbsp;&nbsp;<span style="color: var(--primary);">rutina</span> - Reporte de rutinas<br>&nbsp;&nbsp;<span style="color: var(--primary);">study [tema]</span> - Guía rápida<br>&nbsp;&nbsp;<span style="color: var(--primary);">eval [expr]</span> - Calculadora<br>&nbsp;&nbsp;<span style="color: var(--primary);">matrix</span> - Lluvia de datos`);
                break;
            case 'clear': terminalOutput.innerHTML = ''; break;
            case 'date': addTerminalLine('output', new Date().toString()); break;
            case 'todo':
                const pending = tasks.filter(t => !t.completed);
                if (pending.length === 0) addTerminalLine('output', '¡No hay tareas pendientes!');
                else {
                    let todoText = '<span style="color: var(--secondary);">Tareas Pendientes:</span><br>';
                    pending.forEach((t, i) => todoText += `&nbsp;&nbsp;[${i+1}] ${escapeHTML(t.title)} (${t.priority.toUpperCase()})<br>`);
                    addTerminalLine('output', todoText);
                }
                break;
            case 'rutina':
            case 'routine':
                const totalM = morningRoutines.length, compM = morningRoutines.filter(r => r.completed).length;
                const totalA = afternoonRoutines.length, compA = afternoonRoutines.filter(r => r.completed).length;
                const totalE = eveningRoutines.length, compE = eveningRoutines.filter(r => r.completed).length;
                const totalAll = totalM + totalA + totalE, compAll = compM + compA + compE;
                const pct = Math.round((compAll / totalAll) * 100);
                addTerminalLine('output', `☁️ Progreso: ${compAll}/${totalAll} (${pct}%)`);
                break;
            case 'study':
                if (args.length === 0) addTerminalLine('output', 'Uso: study [algoritmos|bases-de-datos|redes|git]');
                else addTerminalLine('output', `💡 Estudiando ${args.join(' ')}: ¡La práctica constante es la clave!`);
                break;
            case 'eval':
                if (args.length === 0) addTerminalLine('output', 'Uso: eval [operacion]');
                else {
                    try {
                        const expression = args.join('');
                        if (/^[0-9+\-*/().\s]+$/.test(expression)) {
                            const result = Function(`"use strict"; return (${expression})`)();
                            addTerminalLine('output', `Resultado: ${result}`);
                        } else addTerminalLine('output', 'Error: Solo expresiones matemáticas');
                    } catch (err) { addTerminalLine('output', `Error: ${err.message}`); }
                }
                break;
            case 'matrix':
                addTerminalLine('output', '<span style="color: #10b981;">Iniciando Matrix...</span>');
                let counter = 0;
                const matrixInterval = setInterval(() => {
                    if (counter < 8) {
                        let lineStr = '';
                        for (let i = 0; i < 40; i++) lineStr += Math.random() > 0.5 ? '1' : '0';
                        addTerminalLine('output', `<span style="color: #10b981; opacity: ${1 - (counter * 0.1)};">${lineStr}</span>`);
                        counter++;
                    } else {
                        clearInterval(matrixInterval);
                        addTerminalLine('output', '<span style="color: #c084fc;">¡Acceso concedido!</span>');
                    }
                }, 150);
                break;
            default: addTerminalLine('output', `Comando no reconocido: "${escapeHTML(baseCmd)}". Escribe "help"`);
        }
    };

    terminalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            processCommand(terminalInput.value);
            terminalInput.value = '';
        }
    });

    // -------------------------------------------------------------
    // 7. LOFI STATION AUDIO PLAYER
    // -------------------------------------------------------------
    const lofiAudio = document.getElementById('lofi-audio');
    const btnLofiPlay = document.getElementById('btn-lofi-play');
    const lofiSelect = document.getElementById('lofi-station-select');
    const lofiVolume = document.getElementById('lofi-volume');
    const lofiStatus = document.getElementById('lofi-status');
    let isLofiPlaying = false;

    lofiAudio.volume = lofiVolume ? lofiVolume.value : 0.5;

    const playLofi = () => {
        if (isLofiPlaying) return;
        lofiAudio.src = lofiSelect.value;
        lofiAudio.load();
        if (lofiStatus) lofiStatus.textContent = "Conectando...";
        lofiAudio.play().then(() => {
            isLofiPlaying = true;
            if (btnLofiPlay) btnLofiPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            if (lofiStatus) lofiStatus.textContent = "Online";
            addTerminalLine('system', 'Lofi Station conectada');
        }).catch(err => {
            console.error("Error al reproducir:", err);
            if (lofiStatus) lofiStatus.textContent = "Error";
            stopLofi();
        });
    };

    const stopLofi = () => {
        lofiAudio.pause();
        lofiAudio.removeAttribute('src');
        lofiAudio.load();
        isLofiPlaying = false;
        if (btnLofiPlay) btnLofiPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (lofiStatus) lofiStatus.textContent = "Offline";
        addTerminalLine('system', 'Lofi Station desconectada');
    };

    if (btnLofiPlay) btnLofiPlay.addEventListener('click', () => isLofiPlaying ? stopLofi() : playLofi());
    if (lofiSelect) lofiSelect.addEventListener('change', () => { if (isLofiPlaying) { stopLofi(); setTimeout(playLofi, 250); } });
    if (lofiVolume) lofiVolume.addEventListener('input', (e) => lofiAudio.volume = e.target.value);

    // -------------------------------------------------------------
    // 8. TABS & NAVIGATION CONTROL
    // -------------------------------------------------------------
    const navDashboard = document.getElementById('nav-dashboard');
    const navTasks = document.getElementById('nav-tasks');
    const navTimer = document.getElementById('nav-timer');
    const navNotes = document.getElementById('nav-notes');
    const navRoutines = document.getElementById('nav-routines');
    const sectionDashboard = document.getElementById('section-dashboard');
    const sectionRoutines = document.getElementById('section-routines');
    const sectionNotes = document.getElementById('section-notes');
    const allNavs = [navDashboard, navTasks, navTimer, navNotes, navRoutines];

    const setActiveTab = (activeNav) => {
        allNavs.forEach(nav => nav?.classList.remove('active'));
        if (activeNav) activeNav.classList.add('active');
    };

    const showSection = (sectionToShow) => {
        if (sectionDashboard) sectionDashboard.classList.add('hidden');
        if (sectionRoutines) sectionRoutines.classList.add('hidden');
        if (sectionNotes) sectionNotes.classList.add('hidden');
        if (sectionToShow === 'dashboard' && sectionDashboard) sectionDashboard.classList.remove('hidden');
        else if (sectionToShow === 'routines' && sectionRoutines) sectionRoutines.classList.remove('hidden');
        else if (sectionToShow === 'notes' && sectionNotes) sectionNotes.classList.remove('hidden');
    };

    const scrollToWidget = (selector) => {
        showSection('dashboard');
        const widget = document.querySelector(selector);
        if (widget) {
            widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            widget.classList.add('widget-highlight');
            setTimeout(() => widget.classList.remove('widget-highlight'), 3000);
        }
    };

    if (navDashboard) navDashboard.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(navDashboard); showSection('dashboard'); });
    if (navTasks) navTasks.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(navTasks); scrollToWidget('.widget-tasks'); });
    if (navTimer) navTimer.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(navTimer); scrollToWidget('.widget-pomodoro'); });
    if (navNotes) navNotes.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(navNotes); showSection('notes'); });
    if (navRoutines) navRoutines.addEventListener('click', (e) => { e.preventDefault(); setActiveTab(navRoutines); showSection('routines'); });

    // -------------------------------------------------------------
    // 9. DAILY ROUTINES CHECKLIST MANAGEMENT CON SYNC
    // -------------------------------------------------------------
    const defaultMorningRoutines = [
        { id: 'm1', text: '🌅 Aseo personal', startTime: '08:00', endTime: '08:30', completed: false, processedByRoulette: false },
        { id: 'm2', text: '🥞 Desayuno tierno', startTime: '08:30', endTime: '09:15', completed: false, processedByRoulette: false },
        { id: 'm3', text: '🧘 Estiramientos matutinos', startTime: '09:15', endTime: '09:45', completed: false, processedByRoulette: false },
        { id: 'm4', text: '🎮 Tiempo libre', startTime: '09:45', endTime: '10:45', completed: false, processedByRoulette: false },
        { id: 'm5', text: '🎥 Grabar videos', startTime: '10:45', endTime: '11:45', completed: false, processedByRoulette: false },
        { id: 'm6', text: '🎨 Ocio creativo', startTime: '11:45', endTime: '12:30', completed: false, processedByRoulette: false }
    ];

    const defaultAfternoonRoutines = [
        { id: 'a1', text: '🍱 Almorzar', startTime: '12:30', endTime: '13:00', completed: false, processedByRoulette: false },
        { id: 'a2', text: '💻 Clases Virtuales', startTime: '13:00', endTime: '19:00', completed: false, processedByRoulette: false },
        { id: 'a3', text: '🙋 Participar activamente', startTime: '13:00', endTime: '19:00', completed: false, processedByRoulette: false },
        { id: 'a4', text: '📝 Anotar apuntes', startTime: '13:00', endTime: '19:15', completed: false, processedByRoulette: false }
    ];

    const defaultEveningRoutines = [
        { id: 'e1', text: '🌌 Cenar ligero', startTime: '19:15', endTime: '20:00', completed: false, processedByRoulette: false },
        { id: 'e2', text: '🧠 Repaso Pomodoro', startTime: '20:00', endTime: '21:00', completed: false, processedByRoulette: false },
        { id: 'e3', text: '✨ Skincare', startTime: '21:00', endTime: '21:45', completed: false, processedByRoulette: false },
        { id: 'e4', text: '📵 Desconexión digital', startTime: '22:00', endTime: '23:00', completed: false, processedByRoulette: false }
    ];

    let morningRoutines = loadState('routines-morning', defaultMorningRoutines);
    let afternoonRoutines = loadState('routines-afternoon', defaultAfternoonRoutines);
    let eveningRoutines = loadState('routines-evening', defaultEveningRoutines);

    const syncRoutines = () => {
        syncToFirebase('estudioflow', 'routines', { morningRoutines, afternoonRoutines, eveningRoutines });
    };

    subscribeToFirebase('estudioflow', 'routines', (data) => {
        if (data.morningRoutines && data.afternoonRoutines && data.eveningRoutines && !isSyncing) {
            isSyncing = true;
            morningRoutines = data.morningRoutines;
            afternoonRoutines = data.afternoonRoutines;
            eveningRoutines = data.eveningRoutines;
            saveState('routines-morning', morningRoutines);
            saveState('routines-afternoon', afternoonRoutines);
            saveState('routines-evening', eveningRoutines);
            renderAllRoutines();
            addTerminalLine('system', '☁️ Rutinas sincronizadas desde la nube');
            isSyncing = false;
        }
    });

    const sortRoutines = (arr) => arr.sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
    sortRoutines(morningRoutines);
    sortRoutines(afternoonRoutines);
    sortRoutines(eveningRoutines);

    const morningListEl = document.getElementById('morning-routine-list');
    const afternoonListEl = document.getElementById('afternoon-routine-list');
    const eveningListEl = document.getElementById('evening-routine-list');
    const btnResetRoutines = document.getElementById('btn-reset-routines');
    const btnEditRoutines = document.getElementById('btn-edit-routines');
    const btnSaveEditedRoutines = document.getElementById('btn-save-edited-routines');
    let isEditMode = false;

    const timeToMinutes = (timeStr) => { if (!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const formatMinutesTo12h = (minutes) => { let h = Math.floor(minutes / 60); const m = minutes % 60; const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12; h = h ? h : 12; return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`; };
    const getCurrentTimeMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };

    const realtimeClockEl = document.getElementById('realtime-clock-display');
    const updateRealtimeClock = () => { if (realtimeClockEl) realtimeClockEl.textContent = formatMinutesTo12h(getCurrentTimeMinutes()); };
    updateRealtimeClock();
    setInterval(updateRealtimeClock, 1000);
    setInterval(() => { if (!isEditMode) renderAllRoutines(); }, 15000);

    const renderRoutineBlock = (listEl, routinesArray, storageKey, blockName) => {
        if (!listEl) return;
        listEl.innerHTML = '';
        if (isEditMode) {
            routinesArray.forEach(item => {
                const li = document.createElement('li');
                li.className = 'routine-edit-item';
                li.innerHTML = `
                    <div class="edit-row-title">
                        <input type="text" value="${escapeHTML(item.text)}" class="edit-title-input" data-id="${item.id}">
                        <button class="btn-delete-routine" data-id="${item.id}"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                    <div class="edit-row-times">
                        <span>De:</span><input type="time" value="${item.startTime || '08:00'}" class="edit-start-input" data-id="${item.id}">
                        <span>A:</span><input type="time" value="${item.endTime || '09:00'}" class="edit-end-input" data-id="${item.id}">
                    </div>
                `;
                li.querySelector('.btn-delete-routine').addEventListener('click', (e) => { e.preventDefault(); deleteRoutineItem(item.id, blockName); });
                listEl.appendChild(li);
            });
            const addBtn = document.createElement('button');
            addBtn.className = 'btn-add-routine-placeholder';
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir Tarea';
            addBtn.addEventListener('click', () => addEmptyRoutineItem(blockName));
            listEl.appendChild(addBtn);
        } else {
            const currentMinutes = getCurrentTimeMinutes();
            routinesArray.forEach(item => {
                const startMin = timeToMinutes(item.startTime);
                const endMin = timeToMinutes(item.endTime);
                let state = 'active', badgeClass = 'active', badgeLabel = 'En curso', checkboxIcon = '';
                if (item.completed) { state = 'completed'; badgeClass = 'active'; badgeLabel = 'Lograda'; checkboxIcon = '<i class="fa-solid fa-check"></i>'; }
                else if (currentMinutes < startMin) { state = 'locked'; badgeClass = 'locked'; badgeLabel = 'Próxima'; checkboxIcon = '<i class="fa-solid fa-hourglass"></i>'; }
                else if (currentMinutes > endMin) { state = 'expired'; badgeClass = 'expired'; badgeLabel = item.processedByRoulette ? '⚠️ Castigo Asignado' : '⚠️ Expirada'; checkboxIcon = '<i class="fa-solid fa-circle-xmark"></i>'; }
                const li = document.createElement('li');
                li.className = `routine-item ${state}`;
                li.innerHTML = `<div class="routine-checkbox">${checkboxIcon}</div><span class="routine-title">${escapeHTML(item.text)}</span><span class="routine-time-badge ${badgeClass}">${item.startTime} - ${item.endTime} (${badgeLabel})</span>`;
                li.addEventListener('click', () => {
                    if (state === 'locked') addTerminalLine('system', `Aún no es hora (${item.startTime})`);
                    else if (state === 'expired') addTerminalLine('system', `Tarea expirada a las ${item.endTime}`);
                    else { item.completed = !item.completed; saveState(storageKey, routinesArray); syncRoutines(); renderAllRoutines(); }
                });
                listEl.appendChild(li);
            });
        }
    };

    const renderAllRoutines = () => {
        renderRoutineBlock(morningListEl, morningRoutines, 'routines-morning', 'morning');
        renderRoutineBlock(afternoonListEl, afternoonRoutines, 'routines-afternoon', 'afternoon');
        renderRoutineBlock(eveningListEl, eveningRoutines, 'routines-evening', 'evening');
        if (!isEditMode) updatePunishmentWidgetState(getExpiredRoutinesCount());
    };

    const harvestBlockRoutines = (listEl, originalArray) => {
        const items = listEl.querySelectorAll('.routine-edit-item');
        const harvested = [];
        let isValid = true;
        items.forEach(el => {
            const id = el.querySelector('.edit-title-input').dataset.id;
            const text = el.querySelector('.edit-title-input').value.trim();
            const startTime = el.querySelector('.edit-start-input').value;
            const endTime = el.querySelector('.edit-end-input').value;
            const oldItem = originalArray.find(r => r.id === id);
            const completed = oldItem ? oldItem.completed : false;
            const processedByRoulette = oldItem ? oldItem.processedByRoulette : false;
            if (!text || !startTime || !endTime) isValid = false;
            harvested.push({ id, text, startTime, endTime, completed, processedByRoulette });
        });
        return isValid ? harvested : null;
    };

    const addEmptyRoutineItem = (blockName) => {
        const newItem = { id: 'custom-' + Date.now(), text: 'Nueva tarea ☁️', startTime: '09:00', endTime: '10:00', completed: false, processedByRoulette: false };
        if (blockName === 'morning') morningRoutines.push(newItem);
        else if (blockName === 'afternoon') afternoonRoutines.push(newItem);
        else if (blockName === 'evening') eveningRoutines.push(newItem);
        syncRoutines();
        renderAllRoutines();
    };

    const deleteRoutineItem = (id, blockName) => {
        if (blockName === 'morning') morningRoutines = morningRoutines.filter(r => r.id !== id);
        else if (blockName === 'afternoon') afternoonRoutines = afternoonRoutines.filter(r => r.id !== id);
        else if (blockName === 'evening') eveningRoutines = eveningRoutines.filter(r => r.id !== id);
        syncRoutines();
        renderAllRoutines();
    };

    if (btnEditRoutines && btnSaveEditedRoutines) {
        btnEditRoutines.addEventListener('click', () => { isEditMode = true; btnEditRoutines.classList.add('hidden'); btnSaveEditedRoutines.classList.remove('hidden'); renderAllRoutines(); });
        btnSaveEditedRoutines.addEventListener('click', () => {
            const newMorning = harvestBlockRoutines(morningListEl, morningRoutines);
            const newAfternoon = harvestBlockRoutines(afternoonListEl, afternoonRoutines);
            const newEvening = harvestBlockRoutines(eveningListEl, eveningRoutines);
            if (!newMorning || !newAfternoon || !newEvening) { alert('Completa todos los campos'); return; }
            morningRoutines = newMorning.sort((a,b)=>a.startTime.localeCompare(b.startTime));
            afternoonRoutines = newAfternoon.sort((a,b)=>a.startTime.localeCompare(b.startTime));
            eveningRoutines = newEvening.sort((a,b)=>a.startTime.localeCompare(b.startTime));
            saveState('routines-morning', morningRoutines);
            saveState('routines-afternoon', afternoonRoutines);
            saveState('routines-evening', eveningRoutines);
            syncRoutines();
            isEditMode = false;
            btnSaveEditedRoutines.classList.add('hidden');
            btnEditRoutines.classList.remove('hidden');
            renderAllRoutines();
        });
    }

    if (btnResetRoutines) {
        btnResetRoutines.addEventListener('click', () => {
            if (isEditMode) { isEditMode = false; if(btnSaveEditedRoutines) btnSaveEditedRoutines.classList.add('hidden'); if(btnEditRoutines) btnEditRoutines.classList.remove('hidden'); }
            morningRoutines = morningRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
            afternoonRoutines = afternoonRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
            eveningRoutines = eveningRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
            saveState('routines-morning', morningRoutines);
            saveState('routines-afternoon', afternoonRoutines);
            saveState('routines-evening', eveningRoutines);
            syncRoutines();
            renderAllRoutines();
            resetWaterCount();
            addTerminalLine('system', 'Todas las rutinas reiniciadas');
        });
    }

    // -------------------------------------------------------------
    // 10. WATER TRACKER CON SYNC
    // -------------------------------------------------------------
    let waterCount = loadState('studyflow-water-count', 0);
    let waterTarget = loadState('studyflow-water-target', 6);
    const waterCupsContainer = document.getElementById('water-cups-container');
    const waterCountDisplay = document.getElementById('water-count-display');
    const waterGoalDisplay = document.getElementById('water-goal-display');
    const waterTargetBadge = document.getElementById('water-target-badge');
    const btnAddWater = document.getElementById('btn-add-water');
    const btnRemoveWater = document.getElementById('btn-remove-water');
    const waterGoalSelect = document.getElementById('water-goal-select');
    const waterWidget = document.getElementById('widget-water');

    const syncWater = () => syncToFirebase('estudioflow', 'water', { waterCount, waterTarget });
    subscribeToFirebase('estudioflow', 'water', (data) => {
        if (!isSyncing && data.waterCount !== undefined && data.waterTarget !== undefined) {
            isSyncing = true;
            waterCount = data.waterCount;
            waterTarget = data.waterTarget;
            saveState('studyflow-water-count', waterCount);
            saveState('studyflow-water-target', waterTarget);
            if (waterGoalSelect) waterGoalSelect.value = String(waterTarget);
            renderWaterCups();
            addTerminalLine('system', '💧 Progreso de agua sincronizado');
            isSyncing = false;
        }
    });

    if (waterGoalSelect) waterGoalSelect.value = String(waterTarget);
    const renderWaterCups = () => {
        if (!waterCupsContainer) return;
        waterCupsContainer.innerHTML = '';
        for (let i = 0; i < waterTarget; i++) {
            const cup = document.createElement('button');
            cup.className = `water-cup ${i < waterCount ? 'filled' : ''}`;
            cup.innerHTML = `<i class="fa-solid fa-droplet cup-icon"></i>`;
            cup.addEventListener('click', () => setWaterCount(i + 1));
            waterCupsContainer.appendChild(cup);
        }
        if (waterCountDisplay) waterCountDisplay.textContent = waterCount;
        if (waterGoalDisplay) waterGoalDisplay.textContent = waterTarget;
        if (waterTargetBadge) waterTargetBadge.textContent = `Meta: ${waterTarget} vasos`;
        if (btnRemoveWater) btnRemoveWater.disabled = waterCount === 0;
    };
    const setWaterCount = (newCount) => {
        waterCount = Math.max(0, Math.min(newCount, waterTarget));
        saveState('studyflow-water-count', waterCount);
        syncWater();
        renderWaterCups();
        if (waterCount === waterTarget && waterCount > 0 && waterWidget) {
            waterWidget.classList.add('goal-reached');
            setTimeout(() => waterWidget.classList.remove('goal-reached'), 4500);
            addTerminalLine('system', `💧 ¡Meta de ${waterTarget} vasos alcanzada!`);
        }
    };
    const resetWaterCount = () => { waterCount = 0; saveState('studyflow-water-count', waterCount); syncWater(); renderWaterCups(); };
    if (btnAddWater) btnAddWater.addEventListener('click', () => { if (waterCount < waterTarget) setWaterCount(waterCount + 1); });
    if (btnRemoveWater) btnRemoveWater.addEventListener('click', () => setWaterCount(waterCount - 1));
    if (waterGoalSelect) waterGoalSelect.addEventListener('change', () => { waterTarget = parseInt(waterGoalSelect.value, 10); if (waterCount > waterTarget) waterCount = waterTarget; saveState('studyflow-water-target', waterTarget); saveState('studyflow-water-count', waterCount); syncWater(); renderWaterCups(); });
    renderWaterCups();

    // -------------------------------------------------------------
    // 11. PUNISHMENT ROULETTE CON SYNC
    // -------------------------------------------------------------
    const defaultPunishmentsList = [
        { id: 'p1', name: "Ahorro Obligatorio 💸", desc: "Depositar 5 Bs en tu frasco de ahorros", count: 0 },
        { id: 'p2', name: "Cardio Flash 🧘", desc: "15 sentadillas suaves", count: 0 },
        { id: 'p3', name: "Desintoxicación Móvil 📵", desc: "5 horas sin redes sociales", count: 0 },
        { id: 'p4', name: "Fuerza Gamer ⚡", desc: "10 flexiones de pecho", count: 0 },
        { id: 'p5', name: "Orden Relámpago 🫧", desc: "Organizar escritorio 5 minutos", count: 0 },
        { id: 'p6', name: "Estiramiento Zen ☁️", desc: "5 minutos de estiramientos", count: 0 }
    ];
    let punishmentsList = loadState('routines-punishments-list', defaultPunishmentsList);
    let currentRotation = 0;
    let isSpinning = false;
    const btnSpinRoulette = document.getElementById('btn-spin-roulette');
    const rouletteWheel = document.getElementById('roulette-wheel');
    const punishmentText = document.getElementById('punishment-text');
    const punishmentResultCard = document.getElementById('punishment-result-card');

    const syncPunishments = () => syncToFirebase('estudioflow', 'punishments', { punishmentsList });
    subscribeToFirebase('estudioflow', 'punishments', (data) => {
        if (data.punishmentsList && !isSyncing) {
            isSyncing = true;
            punishmentsList = data.punishmentsList;
            saveState('routines-punishments-list', punishmentsList);
            renderRouletteWheel();
            renderPunishmentLedger();
            addTerminalLine('system', '🎰 Lista de castigos sincronizada');
            isSyncing = false;
        }
    });

    const renderRouletteWheel = () => {
        if (!rouletteWheel) return;
        rouletteWheel.innerHTML = '';
        const N = punishmentsList.length;
        if (N === 0) return;
        const sectorAngle = 360 / N;
        const colors = ['#fce7f3', '#e0f2fe', '#f3e8ff', '#fef9c3', '#ccfbf1', '#ffedd5', '#dbeafe', '#fae8ff', '#ffe4e6', '#f0fdf4'];
        let gradientParts = [];
        for (let i = 0; i < N; i++) {
            const color = colors[i % colors.length];
            const start = i * sectorAngle;
            const end = (i + 1) * sectorAngle;
            gradientParts.push(`${color} ${start}deg ${end}deg`);
        }
        rouletteWheel.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        punishmentsList.forEach((punishment, i) => {
            const angle = (i * sectorAngle) + (sectorAngle / 2);
            const labelDiv = document.createElement('div');
            labelDiv.className = `wheel-label`;
            labelDiv.textContent = punishment.name.length > 20 ? punishment.name.substring(0, 18) + '...' : punishment.name;
            labelDiv.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-82px)`;
            rouletteWheel.appendChild(labelDiv);
        });
    };

    const renderPunishmentLedger = () => {
        const ledgerListEl = document.getElementById('punishment-ledger-list');
        if (!ledgerListEl) return;
        ledgerListEl.innerHTML = '';
        if (punishmentsList.length === 0) {
            ledgerListEl.innerHTML = `<li class="ledger-empty-item"><i class="fa-solid fa-square-check"></i><span>No hay castigos</span></li>`;
            return;
        }
        punishmentsList.forEach(punishment => {
            const li = document.createElement('li');
            li.className = 'ledger-item';
            const count = punishment.count || 0;
            li.innerHTML = `
                <div class="ledger-item-info">
                    <span class="ledger-item-name">${escapeHTML(punishment.name)}</span>
                    <span class="ledger-item-badge ${count > 0 ? 'pending' : 'clear'}">${count > 0 ? `Pendientes: <b>${count}</b>` : '¡Al día! ✨'}</span>
                </div>
                <div class="ledger-item-actions">
                    <button class="btn-ledger-action btn-ledger-add" data-id="${punishment.id}"><i class="fa-solid fa-circle-plus"></i></button>
                    <button class="btn-ledger-action btn-ledger-deduct" data-id="${punishment.id}" ${count === 0 ? 'disabled' : ''}>Descontar</button>
                </div>
            `;
            li.querySelector('.btn-ledger-add').addEventListener('click', () => incrementPunishment(punishment.id));
            li.querySelector('.btn-ledger-deduct').addEventListener('click', () => deductPunishment(punishment.id));
            ledgerListEl.appendChild(li);
        });
    };

    const deductPunishment = (id) => {
        const punishment = punishmentsList.find(p => p.id === id);
        if (punishment && (punishment.count || 0) > 0) {
            punishment.count--;
            saveState('routines-punishments-list', punishmentsList);
            syncPunishments();
            renderPunishmentLedger();
            addTerminalLine('system', `Has completado: "${punishment.name}"`);
        }
    };
    const incrementPunishment = (id) => {
        const punishment = punishmentsList.find(p => p.id === id);
        if (punishment) {
            punishment.count = (punishment.count || 0) + 1;
            saveState('routines-punishments-list', punishmentsList);
            syncPunishments();
            renderPunishmentLedger();
            addTerminalLine('system', `Añadido castigo: "${punishment.name}"`);
        }
    };

    const getExpiredRoutinesCount = () => {
        const currentMinutes = getCurrentTimeMinutes();
        let expiredCount = 0;
        const checkExpired = (routines) => routines.forEach(item => { if (!item.completed && !item.processedByRoulette && currentMinutes > timeToMinutes(item.endTime)) expiredCount++; });
        checkExpired(morningRoutines);
        checkExpired(afternoonRoutines);
        checkExpired(eveningRoutines);
        return expiredCount;
    };

    const updatePunishmentWidgetState = (expiredCount) => {
        const punishmentWidget = document.getElementById('punishment-widget');
        const expiredCountEl = document.getElementById('expired-count');
        if (punishmentWidget && expiredCountEl) {
            expiredCountEl.textContent = expiredCount;
            const totalPendingLedger = punishmentsList.reduce((sum, p) => sum + (p.count || 0), 0);
            if (expiredCount > 0 || totalPendingLedger > 0) punishmentWidget.classList.remove('hidden');
            else punishmentWidget.classList.add('hidden');
            if (btnSpinRoulette) btnSpinRoulette.disabled = expiredCount === 0;
        }
    };

    const findFirstUnprocessedExpiredRoutine = () => {
        const currentMinutes = getCurrentTimeMinutes();
        for (let item of morningRoutines) if (!item.completed && !item.processedByRoulette && currentMinutes > timeToMinutes(item.endTime)) return { block: 'morning', item };
        for (let item of afternoonRoutines) if (!item.completed && !item.processedByRoulette && currentMinutes > timeToMinutes(item.endTime)) return { block: 'afternoon', item };
        for (let item of eveningRoutines) if (!item.completed && !item.processedByRoulette && currentMinutes > timeToMinutes(item.endTime)) return { block: 'evening', item };
        return null;
    };

    if (btnSpinRoulette && rouletteWheel) {
        btnSpinRoulette.addEventListener('click', () => {
            if (isSpinning) return;
            const target = findFirstUnprocessedExpiredRoutine();
            if (!target) { addTerminalLine('system', '¡No hay tareas expiradas!'); return; }
            isSpinning = true;
            btnSpinRoulette.disabled = true;
            const N = punishmentsList.length;
            const selectedIndex = Math.floor(Math.random() * N);
            const sectorAngle = 360 / N;
            const sectorCenter = (selectedIndex * sectorAngle) + (sectorAngle / 2);
            const randomSpins = 6 + Math.floor(Math.random() * 3);
            const randomOffset = (Math.random() * (sectorAngle / 2 - 5)) - (sectorAngle / 4);
            const targetSectorAngle = 360 - sectorCenter + randomOffset;
            const baseRotation = Math.ceil(currentRotation / 360) * 360;
            currentRotation = baseRotation + (360 * randomSpins) + targetSectorAngle;
            rouletteWheel.style.transition = 'transform 4s cubic-bezier(0.1, 0.8, 0.1, 1)';
            rouletteWheel.style.transform = `rotate(${currentRotation}deg)`;
            addTerminalLine('system', `🎰 Girando ruleta por: "${target.item.text}"`);
            setTimeout(() => {
                isSpinning = false;
                const punishment = punishmentsList[selectedIndex];
                punishment.count = (punishment.count || 0) + 1;
                saveState('routines-punishments-list', punishmentsList);
                syncPunishments();
                target.item.processedByRoulette = true;
                if (target.block === 'morning') saveState('routines-morning', morningRoutines);
                else if (target.block === 'afternoon') saveState('routines-afternoon', afternoonRoutines);
                else saveState('routines-evening', eveningRoutines);
                syncRoutines();
                renderAllRoutines();
                renderPunishmentLedger();
                if (punishmentText && punishmentResultCard) {
                    punishmentText.innerHTML = `<strong>${punishment.name}</strong><br>${punishment.desc}<br><span style="color: var(--secondary);">Total: ${punishment.count}</span>`;
                    punishmentResultCard.classList.remove('hidden');
                }
                addTerminalLine('system', `⚠️ Castigo: "${punishment.name}" por "${target.item.text}"`);
                btnSpinRoulette.disabled = false;
            }, 4000);
        });
    }

    const btnAddCustomPunishment = document.getElementById('btn-add-custom-punishment');
    const inputPunishmentName = document.getElementById('new-punishment-name');
    const inputPunishmentDesc = document.getElementById('new-punishment-desc');
    if (btnAddCustomPunishment) {
        btnAddCustomPunishment.addEventListener('click', () => {
            const name = inputPunishmentName?.value.trim();
            const desc = inputPunishmentDesc?.value.trim() || "Castigo personalizado";
            if (!name) { alert('Ingresa un nombre'); return; }
            if (punishmentsList.length >= 10) { alert('Máximo 10 castigos'); return; }
            punishmentsList.push({ id: 'p-custom-' + Date.now(), name, desc, count: 0 });
            saveState('routines-punishments-list', punishmentsList);
            syncPunishments();
            renderRouletteWheel();
            renderPunishmentLedger();
            if (inputPunishmentName) inputPunishmentName.value = '';
            if (inputPunishmentDesc) inputPunishmentDesc.value = '';
            addTerminalLine('system', `Castigo añadido: "${name}"`);
        });
    }

    renderRouletteWheel();
    renderPunishmentLedger();
    renderAllRoutines();

    // Cleanup Firebase subscriptions on page unload
    window.addEventListener('beforeunload', () => {
        firebaseUnsubscribes.forEach(unsubscribe => { if (typeof unsubscribe === 'function') unsubscribe(); });
    });
});
