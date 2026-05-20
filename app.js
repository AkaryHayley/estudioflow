/* ==========================================
   EstudioFlow JS - Core Functionality
   Contains Pomodoro, Task List, Quick Notes,
   and Terminal Simulator.
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
    // 3. POMODORO TIMER WORKER
    // -------------------------------------------------------------
    let timerInterval = null;
    let totalSeconds = 1500; // Default: 25 minutes
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

    // SVG Circular Progress Setup
    const radius = 85;
    const circumference = 2 * Math.PI * radius; // 534.07
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
            bellSound.loop = true; // Loop the bell like a real alarm until closed!
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

        if (totalSeconds === 1500) { // If it was a 25m Pomodoro
            completedPomodoros++;
            saveState('completed-pomodoros', completedPomodoros);
            statPomodorosEl.textContent = completedPomodoros;
            
            // Terminal visual feedback
            addTerminalLine('system', '¡Pomodoro completado! Gran trabajo enfocándote. Tómate un recreo.');
        } else {
            addTerminalLine('system', 'Recreo finalizado. ¡Es hora de volver al código!');
        }
        
        // Open cute Cinnamoroll alarm modal
        const alarmModal = document.getElementById('alarm-modal');
        if (alarmModal) {
            alarmModal.classList.remove('hidden');
        }
        
        playAlertSound();
        resetTimer();
    };

    // Preset time event listeners
    presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const time = parseInt(btn.dataset.time, 10);
            totalSeconds = time;
            secondsLeft = time;
            
            // Set simple label
            if (time === 1500) timerStatusEl.textContent = "Foco";
            else if (time === 300) timerStatusEl.textContent = "Corto";
            else timerStatusEl.textContent = "Largo";
            
            resetTimer();
        });
    });

    btnStart.addEventListener('click', startTimer);
    btnPause.addEventListener('click', pauseTimer);
    btnReset.addEventListener('click', resetTimer);

    // Custom minutes input listener
    const customMinutesInput = document.getElementById('custom-minutes');
    const btnSetCustom = document.getElementById('btn-set-custom');

    if (btnSetCustom && customMinutesInput) {
        btnSetCustom.addEventListener('click', () => {
            const mins = parseInt(customMinutesInput.value, 10);
            if (isNaN(mins) || mins < 1 || mins > 180) {
                alert('Por favor, introduce un número válido de minutos entre 1 y 180. 🎀');
                return;
            }
            
            // Remove active class from presets
            presetBtns.forEach(b => b.classList.remove('active'));
            
            totalSeconds = mins * 60;
            secondsLeft = totalSeconds;
            
            timerStatusEl.textContent = `Personalizado (${mins}m)`;
            
            resetTimer();
            addTerminalLine('system', `Cronómetro configurado en modo personalizado: ${mins} minutos.`);
            
            // Visual feedback on button click
            const originalHtml = btnSetCustom.innerHTML;
            btnSetCustom.innerHTML = '<i class="fa-solid fa-check"></i>';
            btnSetCustom.style.background = 'var(--success)';
            
            setTimeout(() => {
                btnSetCustom.innerHTML = originalHtml;
                btnSetCustom.style.background = '';
            }, 1000);
        });

        // Trigger set custom on Enter key in number input
        customMinutesInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btnSetCustom.click();
            }
        });
    }

    // Alarm modal close button and logic
    const alarmModal = document.getElementById('alarm-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            if (alarmModal) {
                alarmModal.classList.add('hidden');
            }
            stopAlertSound();
            if (bellSound) {
                bellSound.pause();
                bellSound.loop = false;
                bellSound.currentTime = 0;
            }
            addTerminalLine('system', 'Alarma detenida. ¡A seguir con el flujo! 🤍');
        });
    }

    // Initial setup
    statPomodorosEl.textContent = completedPomodoros;
    resetTimer();


    // -------------------------------------------------------------
    // 4. TASK MANAGER (TO-DO LIST)
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

            // Event Listeners for inside items
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
        const newTask = {
            id: Date.now(),
            title,
            priority,
            completed: false
        };

        tasks.push(newTask);
        saveState('tasks-list', tasks);
        renderTasks();

        inputTaskTitle.value = '';
        addTerminalLine('system', `Tarea añadida: "${title}"`);
    };

    btnAddTask.addEventListener('click', addTask);
    inputTaskTitle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // Helper to escape HTML and prevent XSS injections
    const escapeHTML = (str) => {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    };

    // Initial render
    renderTasks();


    // -------------------------------------------------------------
    // 5. COZY MULTI-NOTEBOOK SYSTEM (Mis Cuadernos)
    // -------------------------------------------------------------
    const notebooksListEl = document.getElementById('notebooks-list');
    const btnCreateNotebook = document.getElementById('btn-add-notebook');
    const activeTitleInput = document.getElementById('active-notebook-title');
    const noteArea = document.getElementById('quick-note');
    const btnSaveNote = document.getElementById('btn-save-note');
    const btnClearNote = document.getElementById('btn-clear-note');
    const autosaveStatus = document.getElementById('autosave-status');

    // Default notebooks matching subjects
    const defaultNotebooks = [
        { id: "nb-prog", title: "💻 Programación", content: "" },
        { id: "nb-db", title: "🗄️ Bases de Datos", content: "" },
        { id: "nb-sys", title: "🌐 Redes y Sistemas", content: "" }
    ];

    // Load and migrate state
    let notebooks = loadState('studyflow-notebooks-list', null);
    if (!notebooks) {
        notebooks = defaultNotebooks;
        const oldNote = localStorage.getItem('studyflow-quick-note');
        if (oldNote) {
            notebooks[0].content = oldNote;
        }
        saveState('studyflow-notebooks-list', notebooks);
    }

    let activeNotebookId = localStorage.getItem('studyflow-active-notebook-id') || 'nb-prog';
    // Fallback if deleted active
    if (!notebooks.find(nb => nb.id === activeNotebookId) && notebooks.length > 0) {
        activeNotebookId = notebooks[0].id;
    }

    const saveCurrentNotebookContent = () => {
        const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
        if (activeNb && noteArea) {
            activeNb.content = noteArea.value;
            saveState('studyflow-notebooks-list', notebooks);
        }
    };

    const loadActiveNotebook = () => {
        const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
        if (activeNb) {
            if (noteArea) noteArea.value = activeNb.content || '';
            if (activeTitleInput) activeTitleInput.value = activeNb.title;
            if (autosaveStatus) {
                autosaveStatus.textContent = "Apuntes guardados";
                autosaveStatus.classList.remove('saving');
            }
        }
    };

    // Autosave Debounce Logic
    let autosaveTimeout = null;
    const triggerAutosave = () => {
        if (autosaveStatus) {
            autosaveStatus.textContent = "Guardando...";
            autosaveStatus.classList.add('saving');
        }
        
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => {
            saveCurrentNotebookContent();
            if (autosaveStatus) {
                autosaveStatus.textContent = "Apuntes guardados ☁️";
                autosaveStatus.classList.remove('saving');
            }
        }, 1000);
    };

    const renderNotebooksSidebar = () => {
        if (!notebooksListEl) return;
        notebooksListEl.innerHTML = '';
        
        notebooks.forEach(nb => {
            const li = document.createElement('li');
            li.className = `notebook-item ${nb.id === activeNotebookId ? 'active' : ''}`;
            li.dataset.id = nb.id;
            
            // Standard notebook structure
            li.innerHTML = `
                <span class="notebook-item-title">${escapeHTML(nb.title)}</span>
            `;
            
            // Add delete button only for custom (non-default) notebooks
            const isDefault = ['nb-prog', 'nb-db', 'nb-sys'].includes(nb.id);
            if (!isDefault) {
                const btnDelete = document.createElement('button');
                btnDelete.className = 'btn-delete-notebook';
                btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                btnDelete.title = "Eliminar cuaderno";
                
                btnDelete.addEventListener('click', (e) => {
                    e.stopPropagation(); // Avoid selecting the item
                    if (confirm(`¿Estás seguro de que quieres borrar el cuaderno "${nb.title}"? Todos los apuntes en él se perderán de forma permanente. ☁️🎀`)) {
                        notebooks = notebooks.filter(item => item.id !== nb.id);
                        saveState('studyflow-notebooks-list', notebooks);
                        
                        if (activeNotebookId === nb.id) {
                            activeNotebookId = notebooks.length > 0 ? notebooks[0].id : 'nb-prog';
                            localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
                        }
                        
                        renderNotebooksSidebar();
                        loadActiveNotebook();
                        addTerminalLine('system', `Cuaderno eliminado: "${nb.title}"`);
                    }
                });
                
                li.appendChild(btnDelete);
            }
            
            // Selection event listener
            li.addEventListener('click', () => {
                if (activeNotebookId === nb.id) return;
                
                // Save current note area content before switching
                saveCurrentNotebookContent();
                
                activeNotebookId = nb.id;
                localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
                
                // Re-render and load
                renderNotebooksSidebar();
                loadActiveNotebook();
            });
            
            notebooksListEl.appendChild(li);
        });
    };

    // Listeners for manual triggers
    if (noteArea) {
        noteArea.addEventListener('input', triggerAutosave);
    }

    if (activeTitleInput) {
        activeTitleInput.addEventListener('input', () => {
            const newTitle = activeTitleInput.value.trim();
            if (!newTitle) return;
            
            const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
            if (activeNb) {
                activeNb.title = newTitle;
                saveState('studyflow-notebooks-list', notebooks);
                
                // Live update in sidebar titles without full re-render
                const label = document.querySelector(`.notebook-item[data-id="${activeNotebookId}"] .notebook-item-title`);
                if (label) {
                    label.textContent = newTitle;
                }
            }
        });
    }

    if (btnSaveNote) {
        btnSaveNote.addEventListener('click', () => {
            saveCurrentNotebookContent();
            
            // Visual button feedback
            const originalText = btnSaveNote.innerHTML;
            btnSaveNote.innerHTML = '<i class="fa-solid fa-check"></i> ¡Guardado!';
            btnSaveNote.style.background = 'var(--success)';
            
            setTimeout(() => {
                btnSaveNote.innerHTML = originalText;
                btnSaveNote.style.background = '';
            }, 1500);

            if (autosaveStatus) {
                autosaveStatus.textContent = "Apuntes guardados ☁️";
            }
            const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
            const title = activeNb ? activeNb.title : 'Cuaderno';
            addTerminalLine('system', `Apuntes del cuaderno "${title}" guardados en almacenamiento local.`);
        });
    }

    if (btnClearNote && noteArea) {
        btnClearNote.addEventListener('click', () => {
            const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
            const title = activeNb ? activeNb.title : 'cuaderno';
            if (confirm(`¿Estás seguro de que quieres borrar todos los apuntes del cuaderno "${title}"? Esta acción no se puede deshacer. ☁️🎀`)) {
                noteArea.value = '';
                saveCurrentNotebookContent();
                
                // Visual feedback on clear button
                const originalText = btnClearNote.innerHTML;
                btnClearNote.innerHTML = '<i class="fa-solid fa-trash-can"></i> ¡Borrado!';
                btnClearNote.style.background = 'var(--danger)';
                btnClearNote.style.color = 'white';
                
                setTimeout(() => {
                    btnClearNote.innerHTML = originalText;
                    btnClearNote.style.background = '';
                    btnClearNote.style.color = '';
                }, 1500);
                
                addTerminalLine('system', `Se han borrado los apuntes del cuaderno "${title}".`);
            }
        });
    }

    if (btnCreateNotebook) {
        btnCreateNotebook.addEventListener('click', (e) => {
            e.preventDefault();
            const name = prompt('Introduce el nombre del nuevo cuaderno: 🎀', 'Nuevo Cuaderno ☁️');
            if (name === null) return; // Clicked cancel
            const title = name.trim() || 'Apuntes Rápidos ☁️';
            
            const newId = 'nb-custom-' + Date.now();
            const newNb = {
                id: newId,
                title: title,
                content: ''
            };
            
            saveCurrentNotebookContent();
            
            notebooks.push(newNb);
            saveState('studyflow-notebooks-list', notebooks);
            
            activeNotebookId = newId;
            localStorage.setItem('studyflow-active-notebook-id', newId);
            
            renderNotebooksSidebar();
            loadActiveNotebook();
            
            addTerminalLine('system', `Se ha creado el cuaderno "${title}".`);
        });
    }

    // Initialize Notebooks
    renderNotebooksSidebar();
    loadActiveNotebook();


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
            line.innerHTML = text; // Direct formatting for command outputs
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
                addTerminalLine('output', `
                    Comandos disponibles:<br>
                    &nbsp;&nbsp;<span style="color: var(--primary);">help</span> - Muestra este menú de ayuda.<br>
                    &nbsp;&nbsp;<span style="color: var(--primary);">clear</span> - Limpia la pantalla de la consola.<br>
                    &nbsp;&nbsp;<span style="color: var(--primary);">date</span> - Muestra la fecha y hora actual.<br>
                    &nbsp;&nbsp;<span style="color: var(--primary);">todo</span> - Muestra la lista de tareas pendientes.<br>
                    &nbsp;&nbsp;<span style="color: var(--primary);">rutina</span> - Muestra reporte de tus rutinas diarias.<br>
                    &nbsp;&nbsp;<span style="color: var(--primary);">study [tema]</span> - Guía rápida sobre temas de sistemas (Ej: study git).<br>
                    &nbsp;&nbsp;<span style="color: var(--primary);">eval [expr]</span> - Evalúa operaciones matemáticas (Ej: eval (5+3)*4).<br>
                    &nbsp;&nbsp;<span style="color: var(--primary);">matrix</span> - Activa lluvia de datos binarios estilo Matrix.
                `);
                break;
            case 'clear':
                terminalOutput.innerHTML = '';
                break;
            case 'date':
                addTerminalLine('output', new Date().toString());
                break;
            case 'todo':
                const pending = tasks.filter(t => !t.completed);
                if (pending.length === 0) {
                    addTerminalLine('output', '¡Felicidades! No tienes tareas pendientes para hoy.');
                } else {
                    let todoText = '<span style="color: var(--secondary); font-weight: bold;">Tareas Pendientes:</span><br>';
                    pending.forEach((t, i) => {
                        todoText += `&nbsp;&nbsp;[${i + 1}] ${escapeHTML(t.title)} (${t.priority.toUpperCase()})<br>`;
                    });
                    addTerminalLine('output', todoText);
                }
                break;
            case 'rutina':
            case 'routine':
                const totalM = morningRoutines.length;
                const compM = morningRoutines.filter(r => r.completed).length;
                const totalA = afternoonRoutines.length;
                const compA = afternoonRoutines.filter(r => r.completed).length;
                const totalE = eveningRoutines.length;
                const compE = eveningRoutines.filter(r => r.completed).length;

                const totalAll = totalM + totalA + totalE;
                const compAll = compM + compA + compE;
                const pct = Math.round((compAll / totalAll) * 100);

                let reportText = `<span style="color: var(--secondary); font-weight: bold;">☁️ Reporte de Rutinas ☁️</span><br>`;
                reportText += `🌅 <span style="color: var(--primary); font-weight: bold;">Mañana:</span> ${compM}/${totalM} listos.<br>`;
                reportText += `💻 <span style="color: var(--secondary); font-weight: bold;">Tarde (Clases):</span> ${compA}/${totalA} listos.<br>`;
                reportText += `🌙 <span style="color: #8b5cf6; font-weight: bold;">Noche:</span> ${compE}/${totalE} listos.<br>`;
                reportText += `🌟 <span style="color: var(--success); font-weight: bold;">Total:</span> ${compAll}/${totalAll} (${pct}%)<br>`;

                if (pct === 100) {
                    reportText += `<span style="color: var(--secondary); font-weight: bold;">✨ ¡100%! Cinnamoroll está orgulloso de ti 🤍✈️</span>`;
                } else if (pct >= 50) {
                    reportText += `<span style="color: var(--primary);">🌤️ ¡Excelente progreso hoy! Sigue así.</span>`;
                } else {
                    reportText += `<span style="color: var(--text-muted);">🤍 Paso a paso. ¡Ánimo con tus metas!</span>`;
                }
                addTerminalLine('output', reportText);
                break;
            case 'study':
                if (args.length === 0) {
                    addTerminalLine('output', 'Uso: study [algoritmos | bases-de-datos | redes | git | programacion]');
                } else {
                    const topic = args.join(' ').toLowerCase();
                    if (topic.includes('algoritmo') || topic.includes('grafo') || topic.includes('arbol')) {
                        addTerminalLine('output', '💡 <span style="color: #10b981;">Algoritmos:</span> Recuerda graficar siempre tus nodos en papel. Los algoritmos como Dijkstra o BFS/DFS son la base de los motores de búsqueda y mapas. ¡Tú puedes dominarlos!');
                    } else if (topic.includes('base') || topic.includes('sql') || topic.includes('db')) {
                        addTerminalLine('output', '💡 <span style="color: #10b981;">Bases de Datos:</span> La normalización (hasta 3FN) evita la redundancia. En sistemas masivos, diseña buenos índices para acelerar las consultas.');
                    } else if (topic.includes('red') || topic.includes('internet') || topic.includes('tcp')) {
                        addTerminalLine('output', '💡 <span style="color: #10b981;">Redes:</span> Recuerda el modelo OSI y sus 7 capas. La mayoría de los bugs de redes modernos ocurren en la capa 4 (Transporte) o capa 7 (Aplicación).');
                    } else if (topic.includes('git')) {
                        addTerminalLine('output', '💡 <span style="color: #10b981;">Git:</span> "Commit early, push often". Si cometes un error grave, `git reflog` es tu mejor amigo para recuperar commits perdidos.');
                    } else {
                        addTerminalLine('output', `💡 <span style="color: #10b981;">${args.join(' ')}:</span> El secreto del éxito en sistemas es romper un gran problema en pequeñas partes manejables. ¡Empieza hoy escribiendo la primera línea!`);
                    }
                }
                break;
            case 'eval':
                if (args.length === 0) {
                    addTerminalLine('output', 'Uso: eval [operacion_matematica] (Ej: eval (5+3)*2)');
                } else {
                    try {
                        const expression = args.join('');
                        // Basic validation to prevent arbitrary code execution (simple math allowed)
                        if (/^[0-9+\-*/().\s]+$/.test(expression)) {
                            const result = Function(`"use strict"; return (${expression})`)();
                            addTerminalLine('output', `<span style="color: #10b981;">Resultado:</span> ${result}`);
                        } else {
                            addTerminalLine('output', '<span style="color: #ef4444;">Error:</span> Solo se permiten expresiones matemáticas numéricas.');
                        }
                    } catch (err) {
                        addTerminalLine('output', `<span style="color: #ef4444;">Error de evaluación:</span> ${err.message}`);
                    }
                }
                break;
            case 'matrix':
                addTerminalLine('output', '<span style="color: #10b981;">Iniciando descarga de datos de la red...</span>');
                let counter = 0;
                const matrixInterval = setInterval(() => {
                    if (counter < 8) {
                        let lineStr = '';
                        for (let i = 0; i < 40; i++) {
                            lineStr += Math.random() > 0.5 ? '1' : '0';
                        }
                        addTerminalLine('output', `<span style="color: #10b981; opacity: ${1 - (counter * 0.1)};">${lineStr}</span>`);
                        counter++;
                    } else {
                        clearInterval(matrixInterval);
                        addTerminalLine('output', '<span style="color: #c084fc;">Acceso completo al servidor. Listo para compilar.</span>');
                    }
                }, 150);
                break;
            default:
                addTerminalLine('output', `<span style="color: #ef4444;">Comando no reconocido:</span> "${escapeHTML(baseCmd)}". Escribe <span style="color: var(--primary);">help</span> para ver opciones.`);
        }
    };

    terminalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const cmd = terminalInput.value;
            processCommand(cmd);
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

    // Configurar volumen inicial
    lofiAudio.volume = lofiVolume.value;

    const playLofi = () => {
        if (isLofiPlaying) return;
        
        // Cargar stream desde la opción seleccionada
        lofiAudio.src = lofiSelect.value;
        lofiAudio.load();
        
        lofiStatus.textContent = "Conectando...";
        lofiStatus.className = "player-status"; 
        
        lofiAudio.play()
            .then(() => {
                isLofiPlaying = true;
                btnLofiPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
                btnLofiPlay.classList.add('playing');
                lofiStatus.textContent = "Online";
                lofiStatus.classList.add('playing');
                addTerminalLine('system', 'Lofi Station conectada. ¡Música cargada para programar!');
            })
            .catch(err => {
                console.error("Error al reproducir audio:", err);
                lofiStatus.textContent = "Error";
                addTerminalLine('system', 'Fallo al conectar con la radio. Intenta con otro canal.');
                stopLofi();
            });
    };

    const stopLofi = () => {
        lofiAudio.pause();
        // Limpiamos src para detener la transferencia de datos en segundo plano
        lofiAudio.removeAttribute('src');
        lofiAudio.load();
        
        isLofiPlaying = false;
        btnLofiPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        btnLofiPlay.classList.remove('playing');
        lofiStatus.textContent = "Offline";
        lofiStatus.classList.remove('playing');
        addTerminalLine('system', 'Lofi Station desconectada.');
    };

    btnLofiPlay.addEventListener('click', () => {
        if (isLofiPlaying) {
            stopLofi();
        } else {
            playLofi();
        }
    });

    // Cambiar de canal
    lofiSelect.addEventListener('change', () => {
        if (isLofiPlaying) {
            stopLofi();
            setTimeout(playLofi, 250); // Pequeño delay para liberar recursos de la red
        }
    });

    // Control de volumen
    lofiVolume.addEventListener('input', (e) => {
        lofiAudio.volume = e.target.value;
    });

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
        allNavs.forEach(nav => nav.classList.remove('active'));
        activeNav.classList.add('active');
    };

    const showSection = (sectionToShow) => {
        if (sectionToShow === 'dashboard') {
            sectionDashboard.classList.remove('hidden');
            sectionRoutines.classList.add('hidden');
            if (sectionNotes) sectionNotes.classList.add('hidden');
        } else if (sectionToShow === 'routines') {
            sectionDashboard.classList.add('hidden');
            sectionRoutines.classList.remove('hidden');
            if (sectionNotes) sectionNotes.classList.add('hidden');
        } else if (sectionToShow === 'notes') {
            sectionDashboard.classList.add('hidden');
            sectionRoutines.classList.add('hidden');
            if (sectionNotes) sectionNotes.classList.remove('hidden');
        }
    };

    const scrollToWidget = (selector) => {
        showSection('dashboard');
        const widget = document.querySelector(selector);
        if (widget) {
            widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            widget.classList.add('widget-highlight');
            setTimeout(() => {
                widget.classList.remove('widget-highlight');
            }, 3000);
        }
    };

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab(navDashboard);
        showSection('dashboard');
    });

    navTasks.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab(navTasks);
        scrollToWidget('.widget-tasks');
    });

    navTimer.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab(navTimer);
        scrollToWidget('.widget-pomodoro');
    });

    navNotes.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab(navNotes);
        showSection('notes');
    });

    navRoutines.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab(navRoutines);
        showSection('routines');
    });

    // -------------------------------------------------------------
    // 9. DAILY ROUTINES CHECKLIST MANAGEMENT & MIGRATION
    // -------------------------------------------------------------
    // Default list of routines (Adjusted for heavy study class 1-7 PM and light recreational morning)
    const defaultMorningRoutines = [
        { id: 'm1', text: '🌅 Aseo personal (cepillarse y arreglarse 🫧)', startTime: '08:00', endTime: '08:30', completed: false },
        { id: 'm2', text: '🥞 Desayuno tierno y nutritivo (con té o café ☕)', startTime: '08:30', endTime: '09:15', completed: false },
        { id: 'm3', text: '🧘 Estiramientos matutinos o yoga suave (15 min ☁️)', startTime: '09:15', endTime: '09:45', completed: false },
        { id: 'm4', text: '🎮 Tiempo libre: Ver anime, leer manga o novelas 🕹️', startTime: '09:45', endTime: '10:45', completed: false },
        { id: 'm5', text: '🎥 Grabar y planear videos para redes sociales 🎥', startTime: '10:45', endTime: '11:45', completed: false },
        { id: 'm6', text: '🎨 Ocio creativo: Diseñar interfaces bonitas pastel 🎀', startTime: '11:45', endTime: '12:30', completed: false }
    ];

    const defaultAfternoonRoutines = [
        { id: 'a1', text: '🍱 Almorzar rico antes de las clases (12:00 PM)', startTime: '12:30', endTime: '13:00', completed: false },
        { id: 'a2', text: '💻 Clases Virtuales de Sistemas (1:00 PM - 7:00 PM)', startTime: '13:00', endTime: '19:00', completed: false },
        { id: 'a3', text: '🙋 Participar activamente y resolver dudas de código', startTime: '13:00', endTime: '19:00', completed: false },
        { id: 'a4', text: '📝 Anotar apuntes rápidos de programación en EstudioFlow', startTime: '13:00', endTime: '19:15', completed: false }
    ];

    const defaultEveningRoutines = [
        { id: 'e1', text: '🌌 Cenar algo ligero y reponer energías', startTime: '19:15', endTime: '20:00', completed: false },
        { id: 'e2', text: '🧠 Repaso de clases: Un ciclo Pomodoro (25 min)', startTime: '20:00', endTime: '21:00', completed: false },
        { id: 'e3', text: '✨ Autocuidado: Rutina de skincare nocturno completo 🫧', startTime: '21:00', endTime: '21:45', completed: false },
        { id: 'e4', text: '📵 Desconexión digital 30 min antes de dormir ☁️', startTime: '22:00', endTime: '23:00', completed: false }
    ];

    let morningRoutines = loadState('routines-morning', defaultMorningRoutines);
    let afternoonRoutines = loadState('routines-afternoon', defaultAfternoonRoutines);
    let eveningRoutines = loadState('routines-evening', defaultEveningRoutines);

    // Migration to verify if routines have the startTime/endTime structure
    const hasTimeStructure = (routines) => {
        return routines && routines.length > 0 && routines[0].hasOwnProperty('startTime');
    };

    if (!hasTimeStructure(morningRoutines)) {
        morningRoutines = defaultMorningRoutines;
        saveState('routines-morning', morningRoutines);
    }
    if (!hasTimeStructure(afternoonRoutines)) {
        afternoonRoutines = defaultAfternoonRoutines;
        saveState('routines-afternoon', afternoonRoutines);
    }
    if (!hasTimeStructure(eveningRoutines)) {
        eveningRoutines = defaultEveningRoutines;
        saveState('routines-evening', eveningRoutines);
    }

    // Ordenar las rutinas cronológicamente por hora de inicio en el arranque
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

    // Helper functions for time conversion and validation
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const formatMinutesTo12h = (minutes) => {
        let h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12; // 0 should be 12
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    // -------------------------------------------------------------
    // REAL-TIME CLOCK (Reemplaza al Simulador Virtual)
    // -------------------------------------------------------------
    // getCurrentTimeMinutes siempre usa la hora real del dispositivo
    const getCurrentTimeMinutes = () => {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    };

    // Actualizar el reloj en la card de rutinas cada segundo
    const realtimeClockEl = document.getElementById('realtime-clock-display');
    const updateRealtimeClock = () => {
        if (!realtimeClockEl) return;
        const now = new Date();
        realtimeClockEl.textContent = formatMinutesTo12h(now.getHours() * 60 + now.getMinutes());
    };
    updateRealtimeClock();
    setInterval(updateRealtimeClock, 1000); // Actualizar cada segundo

    // Refrescar estado de rutinas cada 15 segundos con hora real
    setInterval(() => {
        if (!isEditMode) {
            renderAllRoutines();
        }
    }, 15000);

    // Expired Tasks Calculations
    const getExpiredRoutinesCount = () => {
        const currentMinutes = getCurrentTimeMinutes();
        let expiredCount = 0;
        
        const countExpired = (routines) => {
            routines.forEach(item => {
                if (!item.completed && !item.processedByRoulette) {
                    const endMin = timeToMinutes(item.endTime);
                    if (currentMinutes > endMin) {
                        expiredCount++;
                    }
                }
            });
        };
        
        countExpired(morningRoutines);
        countExpired(afternoonRoutines);
        countExpired(eveningRoutines);
        
        return expiredCount;
    };

    const updatePunishmentWidgetState = (expiredCount) => {
        const punishmentWidget = document.getElementById('punishment-widget');
        const expiredCountEl = document.getElementById('expired-count');
        const btnSpin = document.getElementById('btn-spin-roulette');
        
        if (punishmentWidget && expiredCountEl) {
            expiredCountEl.textContent = expiredCount;
            
            // Calculate pending ledger items
            const totalPendingLedger = punishmentsList.reduce((sum, p) => sum + (p.count || 0), 0);
            
            if (expiredCount > 0 || totalPendingLedger > 0) {
                punishmentWidget.classList.remove('hidden');
                if (btnSpin) {
                    btnSpin.disabled = (expiredCount === 0);
                    if (expiredCount === 0) {
                        btnSpin.innerHTML = '<i class="fa-solid fa-square-check"></i> ¡Todo al día!';
                    } else {
                        btnSpin.innerHTML = '<i class="fa-solid fa-dice"></i> ¡Girar Ruleta!';
                    }
                }
            } else {
                punishmentWidget.classList.add('hidden');
            }
        }
    };

    const updateTerminalRoutineFeedback = () => {
        const total = morningRoutines.length + afternoonRoutines.length + eveningRoutines.length;
        const comp = morningRoutines.filter(r => r.completed).length + afternoonRoutines.filter(r => r.completed).length + eveningRoutines.filter(r => r.completed).length;
        if (comp > 0) {
            addTerminalLine('system', `Progreso de rutina: ${comp}/${total} completado (${Math.round((comp/total)*100)}%). ¡Excelente avance! ✨☁️`);
        }
    };

    // Render logic for a single block
    const renderRoutineBlock = (listEl, routinesArray, storageKey, blockName) => {
        listEl.innerHTML = '';
        
        if (isEditMode) {
            // Render CRUD rows
            routinesArray.forEach(item => {
                const li = document.createElement('li');
                li.className = 'routine-edit-item';
                li.innerHTML = `
                    <div class="edit-row-title">
                        <input type="text" value="${escapeHTML(item.text)}" class="edit-title-input" data-id="${item.id}" placeholder="Nombre de la tarea...">
                        <button class="btn-delete-routine" data-id="${item.id}" title="Eliminar tarea">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                    <div class="edit-row-times">
                        <span>De:</span>
                        <input type="time" value="${item.startTime || '08:00'}" class="edit-start-input" data-id="${item.id}">
                        <span>A:</span>
                        <input type="time" value="${item.endTime || '09:00'}" class="edit-end-input" data-id="${item.id}">
                    </div>
                `;
                
                li.querySelector('.btn-delete-routine').addEventListener('click', (e) => {
                    e.preventDefault();
                    deleteRoutineItem(item.id, blockName);
                });
                
                listEl.appendChild(li);
            });
            
            // Add Row Placeholder Button
            const addBtn = document.createElement('button');
            addBtn.className = 'btn-add-routine-placeholder';
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir Tarea';
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                addEmptyRoutineItem(blockName);
            });
            listEl.appendChild(addBtn);
            
        } else {
            // Render locked/active/completed/expired tasks
            const currentMinutes = getCurrentTimeMinutes();
            
            routinesArray.forEach(item => {
                const startMin = timeToMinutes(item.startTime);
                const endMin = timeToMinutes(item.endTime);
                
                let state = 'active'; // 'locked', 'active', 'completed', 'expired'
                let badgeClass = 'active';
                let badgeLabel = 'En curso';
                let checkboxIcon = '';
                
                if (item.completed) {
                    state = 'completed';
                    badgeClass = 'active';
                    badgeLabel = 'Lograda';
                    checkboxIcon = '<i class="fa-solid fa-check"></i>';
                } else if (currentMinutes < startMin) {
                    state = 'locked';
                    badgeClass = 'locked';
                    badgeLabel = 'Próxima';
                    checkboxIcon = '<i class="fa-solid fa-hourglass"></i>';
                } else if (currentMinutes > endMin) {
                    state = 'expired';
                    badgeClass = 'expired';
                    badgeLabel = item.processedByRoulette ? '⚠️ Castigo Asignado' : '⚠️ Expirada';
                    checkboxIcon = '<i class="fa-solid fa-circle-xmark"></i>';
                } else {
                    state = 'active';
                    badgeClass = 'active';
                    badgeLabel = 'En curso';
                    checkboxIcon = '';
                }
                
                const li = document.createElement('li');
                li.className = `routine-item ${state}`;
                li.innerHTML = `
                    <div class="routine-checkbox">
                        ${checkboxIcon}
                    </div>
                    <span class="routine-title">${escapeHTML(item.text)}</span>
                    <span class="routine-time-badge ${badgeClass}">${item.startTime} - ${item.endTime} (${badgeLabel})</span>
                `;
                
                li.addEventListener('click', () => {
                    if (state === 'locked') {
                        addTerminalLine('system', `¡Aún no es hora para esta tarea! Se habilitará a las ${item.startTime}. 🌤️`);
                        return;
                    }
                    if (state === 'expired') {
                        addTerminalLine('system', `¡Esta tarea expiró a las ${item.endTime}! Tienes un castigo pendiente en la ruleta. ⚠️🎰`);
                        return;
                    }
                    
                    item.completed = !item.completed;
                    saveState(storageKey, routinesArray);
                    renderAllRoutines();
                    updateTerminalRoutineFeedback();
                });
                
                listEl.appendChild(li);
            });
        }
    };

    const renderAllRoutines = () => {
        renderRoutineBlock(morningListEl, morningRoutines, 'routines-morning', 'morning');
        renderRoutineBlock(afternoonListEl, afternoonRoutines, 'routines-afternoon', 'afternoon');
        renderRoutineBlock(eveningListEl, eveningRoutines, 'routines-evening', 'evening');
        
        // Dynamic expired state update
        if (!isEditMode) {
            const expiredCount = getExpiredRoutinesCount();
            updatePunishmentWidgetState(expiredCount);
        }
    };

    // CRUD Row Harvesting & Actions
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
            
            if (!text || !startTime || !endTime) {
                isValid = false;
            }
            harvested.push({ id, text, startTime, endTime, completed });
        });
        
        if (!isValid) return null;
        return harvested;
    };

    const addEmptyRoutineItem = (blockName) => {
        const newItem = {
            id: 'custom-' + Date.now(),
            text: 'Nueva tarea ☁️',
            startTime: '09:00',
            endTime: '10:00',
            completed: false
        };
        
        if (blockName === 'morning') {
            const harvested = harvestBlockRoutines(morningListEl, morningRoutines);
            if (harvested) morningRoutines = harvested;
            morningRoutines.push(newItem);
        } else if (blockName === 'afternoon') {
            const harvested = harvestBlockRoutines(afternoonListEl, afternoonRoutines);
            if (harvested) afternoonRoutines = harvested;
            afternoonRoutines.push(newItem);
        } else if (blockName === 'evening') {
            const harvested = harvestBlockRoutines(eveningListEl, eveningRoutines);
            if (harvested) eveningRoutines = harvested;
            eveningRoutines.push(newItem);
        }
        
        renderAllRoutines();
    };

    const deleteRoutineItem = (id, blockName) => {
        if (blockName === 'morning') {
            const harvested = harvestBlockRoutines(morningListEl, morningRoutines);
            if (harvested) morningRoutines = harvested;
            morningRoutines = morningRoutines.filter(r => r.id !== id);
        } else if (blockName === 'afternoon') {
            const harvested = harvestBlockRoutines(afternoonListEl, afternoonRoutines);
            if (harvested) afternoonRoutines = harvested;
            afternoonRoutines = afternoonRoutines.filter(r => r.id !== id);
        } else if (blockName === 'evening') {
            const harvested = harvestBlockRoutines(eveningListEl, eveningRoutines);
            if (harvested) eveningRoutines = harvested;
            eveningRoutines = eveningRoutines.filter(r => r.id !== id);
        }
        renderAllRoutines();
    };

    // Edit Mode Toggles
    if (btnEditRoutines && btnSaveEditedRoutines) {
        btnEditRoutines.addEventListener('click', () => {
            isEditMode = true;
            btnEditRoutines.classList.add('hidden');
            btnSaveEditedRoutines.classList.remove('hidden');
            renderAllRoutines();
            addTerminalLine('system', 'Modo Edición activo. Puedes modificar las tareas y sus horarios. ☁️');
        });
        
        btnSaveEditedRoutines.addEventListener('click', () => {
            const newMorning = harvestBlockRoutines(morningListEl, morningRoutines);
            const newAfternoon = harvestBlockRoutines(afternoonListEl, afternoonRoutines);
            const newEvening = harvestBlockRoutines(eveningListEl, eveningRoutines);
            
            if (!newMorning || !newAfternoon || !newEvening) {
                alert('Por favor, asegúrate de llenar todos los nombres de tareas y horarios. 🎀');
                return;
            }
            
            // Ordenar las tareas cronológicamente antes de guardarlas y renderizarlas
            const sortByStartTime = (a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
            newMorning.sort(sortByStartTime);
            newAfternoon.sort(sortByStartTime);
            newEvening.sort(sortByStartTime);

            morningRoutines = newMorning;
            afternoonRoutines = newAfternoon;
            eveningRoutines = newEvening;
            
            saveState('routines-morning', morningRoutines);
            saveState('routines-afternoon', afternoonRoutines);
            saveState('routines-evening', eveningRoutines);
            
            isEditMode = false;
            btnSaveEditedRoutines.classList.add('hidden');
            btnEditRoutines.classList.remove('hidden');
            renderAllRoutines();
            
            addTerminalLine('system', '¡Cambios en las rutinas guardados con éxito! 💾🌸');
        });
    }

    // Reset routines
    btnResetRoutines.addEventListener('click', () => {
        if (isEditMode) {
            isEditMode = false;
            if (btnSaveEditedRoutines) btnSaveEditedRoutines.classList.add('hidden');
            if (btnEditRoutines) btnEditRoutines.classList.remove('hidden');
        }
        
        morningRoutines = morningRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
        afternoonRoutines = afternoonRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
        eveningRoutines = eveningRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
        
        saveState('routines-morning', morningRoutines);
        saveState('routines-afternoon', afternoonRoutines);
        saveState('routines-evening', eveningRoutines);
        
        renderAllRoutines();

        // Tambien reiniciar el contador de agua del dia
        resetWaterCount();

        const originalHtml = btnResetRoutines.innerHTML;
        btnResetRoutines.innerHTML = '<i class="fa-solid fa-check"></i> ¡Día Reiniciado!';
        btnResetRoutines.style.background = 'var(--success)';
        btnResetRoutines.style.color = 'white';
        
        setTimeout(() => {
            btnResetRoutines.innerHTML = originalHtml;
            btnResetRoutines.style.background = '';
            btnResetRoutines.style.color = '';
        }, 1500);

        addTerminalLine('system', 'Todas las rutinas de hoy se han reiniciado. ¡Que tengas un gran día! ✨🌤️');
    });

    // -------------------------------------------------------------
    // 10b. WATER TRACKER - Mis Vasitos 💧
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

    // Sync the goal selector to match saved preference
    if (waterGoalSelect) {
        waterGoalSelect.value = String(waterTarget);
    }

    const renderWaterCups = () => {
        if (!waterCupsContainer) return;
        waterCupsContainer.innerHTML = '';

        for (let i = 0; i < waterTarget; i++) {
            const cup = document.createElement('button');
            cup.className = `water-cup ${i < waterCount ? 'filled' : ''}`;
            cup.title = i < waterCount ? `Vaso ${i + 1} tomado ✓` : `Tomar vaso ${i + 1}`;
            cup.setAttribute('aria-label', `Vaso de agua ${i + 1}`);
            cup.innerHTML = `<i class="fa-solid fa-droplet cup-icon"></i>`;

            // Click on individual cup to toggle up to that cup
            cup.addEventListener('click', () => {
                const newCount = i + 1;
                if (waterCount >= newCount) {
                    // If already filled up to here, deselect from this cup
                    setWaterCount(newCount - 1);
                } else {
                    setWaterCount(newCount);
                }
            });

            waterCupsContainer.appendChild(cup);
        }

        // Update text displays
        if (waterCountDisplay) waterCountDisplay.textContent = waterCount;
        if (waterGoalDisplay) waterGoalDisplay.textContent = waterTarget;
        if (waterTargetBadge) waterTargetBadge.textContent = `Meta: ${waterTarget} vasos`;

        // Disable remove button if already at 0
        if (btnRemoveWater) btnRemoveWater.disabled = waterCount === 0;
    };

    const setWaterCount = (newCount, animate = true) => {
        const prevCount = waterCount;
        waterCount = Math.max(0, Math.min(newCount, waterTarget));
        saveState('studyflow-water-count', waterCount);

        renderWaterCups();

        // Splash animation on the newly filled cup
        if (animate && waterCount > prevCount && waterCupsContainer) {
            const cups = waterCupsContainer.querySelectorAll('.water-cup');
            const newlyFilled = cups[waterCount - 1];
            if (newlyFilled) {
                newlyFilled.classList.add('splash');
                setTimeout(() => newlyFilled.classList.remove('splash'), 500);
            }
        }

        // Celebrate when goal is reached!
        if (waterCount === waterTarget && waterCount > 0) {
            if (waterWidget) {
                waterWidget.classList.add('goal-reached');
                setTimeout(() => waterWidget.classList.remove('goal-reached'), 4500);
            }
            addTerminalLine('system', `💧 ¡Felicitaciones Akary! Llegaste a tu meta de ${waterTarget} vasitos de agua hoy. Cinnamoroll te regala una estrella 🌟☁️`);
        }
    };

    const resetWaterCount = () => {
        waterCount = 0;
        saveState('studyflow-water-count', waterCount);
        renderWaterCups();
        addTerminalLine('system', 'Contador de agua reiniciado para el nuevo día. 💧¡Recuerda hidratarte!');
    };

    // Button listeners
    if (btnAddWater) {
        btnAddWater.addEventListener('click', () => {
            if (waterCount < waterTarget) {
                setWaterCount(waterCount + 1);
            } else {
                addTerminalLine('system', `✅ ¡Ya alcanzaste tu meta de ${waterTarget} vasos! Sigue así. 💧`);
            }
        });
    }

    if (btnRemoveWater) {
        btnRemoveWater.addEventListener('click', () => {
            setWaterCount(waterCount - 1);
        });
    }

    // Goal selector listener — updates target and re-renders cups
    if (waterGoalSelect) {
        waterGoalSelect.addEventListener('change', () => {
            waterTarget = parseInt(waterGoalSelect.value, 10);
            // Clamp current count to new target
            if (waterCount > waterTarget) waterCount = waterTarget;
            saveState('studyflow-water-target', waterTarget);
            saveState('studyflow-water-count', waterCount);
            renderWaterCups();
            addTerminalLine('system', `Meta diaria de agua actualizada a ${waterTarget} vasos. 💧`);
        });
    }

    // Initial render
    renderWaterCups();


    // -------------------------------------------------------------
    // 10. INTERACTIVE PUNISHMENT ROULETTE & LEDGER
    // -------------------------------------------------------------
    const defaultPunishmentsList = [
        { id: 'p1', name: "Ahorro Obligatorio 💸", desc: "Depositar 5 Bs en tu frasco de ahorros. ¡Disciplina financiera para tu futuro! 💸☁️", count: 0 },
        { id: 'p2', name: "Cardio Flash 🧘", desc: "Realizar 15 sentadillas suaves para reactivar el cuerpo y bombear oxígeno a tu cerebro.  🧘🎀", count: 0 },
        { id: 'p3', name: "Desintoxicación Móvil 📵", desc: "5 horas completas sin mirar redes sociales ni notificaciones en tu celular. ¡Foco total! 📵☁️", count: 0 },
        { id: 'p4', name: "Fuerza Gamer ⚡", desc: "Hacer 10 flexiones de pecho (o lagartijas) en el suelo para fortalecer brazos. ⚡🌤️", count: 0 },
        { id: 'p5', name: "Orden Relámpago 🫧", desc: "Organizar y limpiar tu escritorio de estudio durante 5 minutos. Un espacio limpio es una mente clara. 🫧✨", count: 0 },
        { id: 'p6', name: "Estiramiento Zen ☁️", desc: "5 minutos de estiramientos de espalda, cuello y hombros para evitar fatiga física. ☁️🎀", count: 0 }
    ];

    let punishmentsList = loadState('routines-punishments-list', defaultPunishmentsList);
    let currentRotation = 0;
    let isSpinning = false;
    
    const btnSpinRoulette = document.getElementById('btn-spin-roulette');
    const rouletteWheel = document.getElementById('roulette-wheel');
    const punishmentText = document.getElementById('punishment-text');
    const punishmentResultCard = document.getElementById('punishment-result-card');
    
    // Dynamic wheel sectors and labels rendering
    const renderRouletteWheel = () => {
        if (!rouletteWheel) return;
        rouletteWheel.innerHTML = '';
        
        const N = punishmentsList.length;
        if (N === 0) return;
        
        const sectorAngle = 360 / N;
        
        // Dynamic pastel colors palette
        const colors = [
            '#fce7f3', // Pastel Pink
            '#e0f2fe', // Pastel Sky Blue
            '#f3e8ff', // Pastel Lavender
            '#fef9c3', // Pastel Yellow
            '#ccfbf1', // Pastel Mint
            '#ffedd5', // Pastel Peach
            '#dbeafe', // Light blue
            '#fae8ff', // Light magenta
            '#ffe4e6', // Soft rose
            '#f0fdf4'  // Soft green
        ];
        
        // Build conic-gradient string
        let gradientParts = [];
        for (let i = 0; i < N; i++) {
            const color = colors[i % colors.length];
            const start = i * sectorAngle;
            const end = (i + 1) * sectorAngle;
            gradientParts.push(`${color} ${start}deg ${end}deg`);
        }
        rouletteWheel.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        
        // Render labels dynamically
        punishmentsList.forEach((punishment, i) => {
            const angle = (i * sectorAngle) + (sectorAngle / 2);
            const labelDiv = document.createElement('div');
            labelDiv.className = `wheel-label`;
            const displayName = punishment.name.length > 20 ? punishment.name.substring(0, 18) + '...' : punishment.name;
            labelDiv.textContent = displayName;
            labelDiv.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-82px)`;
            rouletteWheel.appendChild(labelDiv);
        });
    };

    // Punishment Ledger list rendering
    const renderPunishmentLedger = () => {
        const ledgerListEl = document.getElementById('punishment-ledger-list');
        if (!ledgerListEl) return;
        
        ledgerListEl.innerHTML = '';
        
        if (punishmentsList.length === 0) {
            ledgerListEl.innerHTML = `
                <li class="ledger-empty-item">
                    <i class="fa-solid fa-square-check" style="font-size: 1.5rem; color: var(--success);"></i>
                    <span>No hay castigos creados en la ruleta. ☁️🎀</span>
                </li>
            `;
            return;
        }
        
        punishmentsList.forEach(punishment => {
            const li = document.createElement('li');
            li.className = 'ledger-item animate-pop';
            
            const count = punishment.count || 0;
            const badgeClass = count > 0 ? 'pending' : 'clear';
            const badgeText = count > 0 ? `Pendientes: <b>${count}</b>` : '¡Al día! ✨';
            const deductDisabled = count === 0 ? 'disabled' : '';
            
            li.innerHTML = `
                <div class="ledger-item-info">
                    <span class="ledger-item-name">${escapeHTML(punishment.name)}</span>
                    <span class="ledger-item-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="ledger-item-actions">
                    <button class="btn-ledger-action btn-ledger-add" data-id="${punishment.id}" title="Añadir castigo manualmente">
                        <i class="fa-solid fa-circle-plus"></i>
                    </button>
                    <button class="btn-ledger-action btn-ledger-deduct" data-id="${punishment.id}" ${deductDisabled} title="Descontar castigo cumplido">
                        <i class="fa-solid fa-circle-minus"></i> Descontar
                    </button>
                </div>
            `;
            
            li.querySelector('.btn-ledger-add').addEventListener('click', (e) => {
                e.preventDefault();
                incrementPunishment(punishment.id);
            });
            
            li.querySelector('.btn-ledger-deduct').addEventListener('click', (e) => {
                e.preventDefault();
                deductPunishment(punishment.id);
            });
            
            ledgerListEl.appendChild(li);
        });
    };

    const deductPunishment = (id) => {
        const punishment = punishmentsList.find(p => p.id === id);
        if (punishment && (punishment.count || 0) > 0) {
            punishment.count--;
            saveState('routines-punishments-list', punishmentsList);
            
            renderPunishmentLedger();
            
            const unprocessedExpiredCount = getExpiredRoutinesCount();
            updatePunishmentWidgetState(unprocessedExpiredCount);
            
            addTerminalLine('system', `Has completado y descontado una unidad de: "${punishment.name}". ¡Buen trabajo! 🌸✨`);
        }
    };

    const incrementPunishment = (id) => {
        const punishment = punishmentsList.find(p => p.id === id);
        if (punishment) {
            punishment.count = (punishment.count || 0) + 1;
            saveState('routines-punishments-list', punishmentsList);
            
            renderPunishmentLedger();
            
            const unprocessedExpiredCount = getExpiredRoutinesCount();
            updatePunishmentWidgetState(unprocessedExpiredCount);
            
            addTerminalLine('system', `Has añadido una penalización manual de: "${punishment.name}". ⚠️🎰`);
        }
    };

    // Custom punishments creator
    const btnAddCustomPunishment = document.getElementById('btn-add-custom-punishment');
    const inputPunishmentName = document.getElementById('new-punishment-name');
    const inputPunishmentDesc = document.getElementById('new-punishment-desc');

    if (btnAddCustomPunishment && inputPunishmentName && inputPunishmentDesc) {
        btnAddCustomPunishment.addEventListener('click', (e) => {
            e.preventDefault();
            const name = inputPunishmentName.value.trim();
            const desc = inputPunishmentDesc.value.trim();
            
            if (!name) {
                alert('Por favor, ingresa el nombre del castigo. 🎀');
                return;
            }
            
            if (punishmentsList.length >= 10) {
                alert('Por razones estéticas y de espacio en la ruleta, el límite máximo es de 10 castigos. ¡Prueba a cumplir los que ya tienes! ☁️🌸');
                return;
            }
            
            const newId = 'p-custom-' + Date.now();
            const newPunishment = {
                id: newId,
                name: name,
                desc: desc || "Un castigo personalizado para mantener tu disciplina.",
                count: 0
            };
            
            punishmentsList.push(newPunishment);
            saveState('routines-punishments-list', punishmentsList);
            
            inputPunishmentName.value = '';
            inputPunishmentDesc.value = '';
            
            renderRouletteWheel();
            renderPunishmentLedger();
            
            const unprocessedExpiredCount = getExpiredRoutinesCount();
            updatePunishmentWidgetState(unprocessedExpiredCount);
            
            addTerminalLine('system', `Castigo añadido a la ruleta: "${name}" ☁️🎰`);
        });
    }

    // First unprocessed expired routine helper
    const findFirstUnprocessedExpiredRoutine = () => {
        const currentMinutes = getCurrentTimeMinutes();
        
        for (let i = 0; i < morningRoutines.length; i++) {
            const item = morningRoutines[i];
            if (!item.completed && !item.processedByRoulette) {
                if (currentMinutes > timeToMinutes(item.endTime)) {
                    return { block: 'morning', index: i, item };
                }
            }
        }
        
        for (let i = 0; i < afternoonRoutines.length; i++) {
            const item = afternoonRoutines[i];
            if (!item.completed && !item.processedByRoulette) {
                if (currentMinutes > timeToMinutes(item.endTime)) {
                    return { block: 'afternoon', index: i, item };
                }
            }
        }
        
        for (let i = 0; i < eveningRoutines.length; i++) {
            const item = eveningRoutines[i];
            if (!item.completed && !item.processedByRoulette) {
                if (currentMinutes > timeToMinutes(item.endTime)) {
                    return { block: 'evening', index: i, item };
                }
            }
        }
        
        return null;
    };
    
    if (btnSpinRoulette && rouletteWheel) {
        btnSpinRoulette.addEventListener('click', (e) => {
            e.preventDefault();
            if (isSpinning) return;
            
            const target = findFirstUnprocessedExpiredRoutine();
            if (!target) {
                addTerminalLine('system', '¡No tienes tareas expiradas por procesar! ☁️');
                return;
            }
            
            isSpinning = true;
            btnSpinRoulette.disabled = true;
            
            const N = punishmentsList.length;
            const selectedIndex = Math.floor(Math.random() * N);
            
            const sectorAngle = 360 / N;
            const sectorCenter = (selectedIndex * sectorAngle) + (sectorAngle / 2);
            
            // Spin math
            const randomSpins = 6 + Math.floor(Math.random() * 3); // 6 to 8 spins
            const maxOffset = (sectorAngle / 2) - 5;
            const randomOffset = (Math.random() * 2 * maxOffset) - maxOffset;
            const targetSectorAngle = 360 - sectorCenter + randomOffset;
            
            const baseRotation = Math.ceil(currentRotation / 360) * 360;
            currentRotation = baseRotation + (360 * randomSpins) + targetSectorAngle;
            
            rouletteWheel.style.transition = 'transform 4s cubic-bezier(0.1, 0.8, 0.1, 1)';
            rouletteWheel.style.transform = `rotate(${currentRotation}deg)`;
            
            addTerminalLine('system', `🎰 ¡La ruleta está girando! Cinnamoroll está decidiendo tu disciplina por: "${target.item.text}"...`);
            
            const pointer = document.querySelector('.roulette-pointer');
            if (pointer) {
                pointer.style.animation = 'pointer-bounce 0.1s infinite alternate ease-in-out';
            }
            
            setTimeout(() => {
                isSpinning = false;
                
                if (pointer) {
                    pointer.style.animation = 'pointer-bounce 0.6s infinite alternate ease-in-out';
                }
                
                const punishment = punishmentsList[selectedIndex];
                
                // Increment target punishment count in ledger
                punishment.count = (punishment.count || 0) + 1;
                saveState('routines-punishments-list', punishmentsList);
                
                // Mark routine as processed by roulette
                target.item.processedByRoulette = true;
                
                // Save routines state
                if (target.block === 'morning') saveState('routines-morning', morningRoutines);
                else if (target.block === 'afternoon') saveState('routines-afternoon', afternoonRoutines);
                else if (target.block === 'evening') saveState('routines-evening', eveningRoutines);
                
                // Render everything updated
                renderAllRoutines();
                renderPunishmentLedger();
                
                if (punishmentText && punishmentResultCard) {
                    punishmentText.innerHTML = `<strong>${punishment.name}</strong><br>${punishment.desc}<br><span style="color: var(--secondary); font-size: 0.85rem; font-weight: 700;">¡Añadido al Ledger! Total acumulado de este castigo: ${punishment.count}</span>`;
                    punishmentResultCard.classList.remove('hidden');
                    punishmentResultCard.style.animation = 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
                }
                
                addTerminalLine('system', `⚠️ Castigo asignado: "${punishment.name}" por incumplir "${target.item.text}". ¡Cumple y descuenta en tu Ledger! ☁️`);
                
            }, 4000);
        });
    }

    // Startup initializations for Roulette and Ledger
    renderRouletteWheel();
    renderPunishmentLedger();

    // Initial renders on startup
    renderAllRoutines();
});
