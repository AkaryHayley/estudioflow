/* ==========================================
   EstudioFlow JS - COMPLETO (Rutinas + Hora + Vasitos + Todo)
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // FIREBASE Y HELPERS
    // -------------------------------------------------------------
    let db = window.db || null;
    let firestoreAvailable = !!db;
    let isSyncing = false;

    const loadState = (key, defaultValue) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    };
    const saveState = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    };

    const escapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
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
    // RELOJ EN TIEMPO REAL
    // -------------------------------------------------------------
    const realtimeClockEl = document.getElementById('realtime-clock-display');
    const updateRealtimeClock = () => {
        if (!realtimeClockEl) return;
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        realtimeClockEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    };
    updateRealtimeClock();
    setInterval(updateRealtimeClock, 1000);

    // -------------------------------------------------------------
    // DATE
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
        if (firestoreAvailable) db.collection('estudioflow').doc('tasks').set({ tasks }, { merge: true });
    };

    const deleteTask = (id) => {
        tasks = tasks.filter(t => t.id !== id);
        saveState('tasks-list', tasks);
        renderTasks();
        if (firestoreAvailable) db.collection('estudioflow').doc('tasks').set({ tasks }, { merge: true });
    };

    const addTask = () => {
        if (!inputTaskTitle) return;
        const title = inputTaskTitle.value.trim();
        if (!title) return;
        const priority = selectTaskPriority ? selectTaskPriority.value : 'medium';
        tasks.push({ id: Date.now(), title, priority, completed: false });
        saveState('tasks-list', tasks);
        renderTasks();
        if (firestoreAvailable) db.collection('estudioflow').doc('tasks').set({ tasks }, { merge: true });
        inputTaskTitle.value = '';
        addTerminalLine('system', `📝 Tarea añadida: "${title}"`);
    };

    if (btnAddTask) btnAddTask.addEventListener('click', addTask);
    if (inputTaskTitle) inputTaskTitle.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

    renderTasks();

    if (firestoreAvailable) {
        db.collection('estudioflow').doc('tasks').onSnapshot((doc) => {
            if (doc.exists && !isSyncing && doc.data().tasks) {
                isSyncing = true;
                tasks = doc.data().tasks;
                saveState('tasks-list', tasks);
                renderTasks();
                isSyncing = false;
            }
        });
    }

    // -------------------------------------------------------------
    // RUTINAS DIARIAS
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
        if (firestoreAvailable) {
            db.collection('estudioflow').doc('routines').set({ morningRoutines, afternoonRoutines, eveningRoutines }, { merge: true });
        }
    };

    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const getCurrentTimeMinutes = () => {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    };

    const renderRoutines = () => {
        const morningList = document.getElementById('morning-routine-list');
        const afternoonList = document.getElementById('afternoon-routine-list');
        const eveningList = document.getElementById('evening-routine-list');
        
        const currentMinutes = getCurrentTimeMinutes();
        
        const renderBlock = (listEl, routines) => {
            if (!listEl) return;
            listEl.innerHTML = '';
            routines.forEach(item => {
                const startMin = timeToMinutes(item.startTime);
                const endMin = timeToMinutes(item.endTime);
                let state = 'active';
                let checkboxIcon = '';
                let badgeText = 'En curso';
                
                if (item.completed) {
                    state = 'completed';
                    checkboxIcon = '<i class="fa-solid fa-check"></i>';
                    badgeText = '✓ Completada';
                } else if (currentMinutes < startMin) {
                    state = 'locked';
                    checkboxIcon = '<i class="fa-solid fa-hourglass"></i>';
                    badgeText = `🔒 ${item.startTime}`;
                } else if (currentMinutes > endMin) {
                    state = 'expired';
                    checkboxIcon = '<i class="fa-solid fa-circle-xmark"></i>';
                    badgeText = '⚠️ Expirada';
                } else {
                    state = 'active';
                    badgeText = `🕐 ${item.startTime} - ${item.endTime}`;
                }
                
                const li = document.createElement('li');
                li.className = `routine-item ${state}`;
                li.innerHTML = `
                    <div class="routine-checkbox">${checkboxIcon}</div>
                    <span class="routine-title">${escapeHTML(item.text)}</span>
                    <span class="routine-time-badge ${state}">${badgeText}</span>
                `;
                li.addEventListener('click', () => {
                    if (state === 'locked') {
                        addTerminalLine('system', `⏰ "${item.text}" estará disponible a las ${item.startTime}`);
                    } else if (state !== 'expired' && !item.completed) {
                        item.completed = true;
                        saveState('routines-morning', morningRoutines);
                        saveState('routines-afternoon', afternoonRoutines);
                        saveState('routines-evening', eveningRoutines);
                        syncRoutines();
                        renderRoutines();
                        addTerminalLine('system', `✅ Completaste: "${item.text}"`);
                    } else if (state === 'expired') {
                        addTerminalLine('system', `⚠️ "${item.text}" expiró - tendrás un castigo en la ruleta`);
                    }
                });
                listEl.appendChild(li);
            });
        };
        
        renderBlock(morningList, morningRoutines);
        renderBlock(afternoonList, afternoonRoutines);
        renderBlock(eveningList, eveningRoutines);
    };

    renderRoutines();

    if (firestoreAvailable) {
        db.collection('estudioflow').doc('routines').onSnapshot((doc) => {
            if (doc.exists && !isSyncing && doc.data().morningRoutines) {
                isSyncing = true;
                morningRoutines = doc.data().morningRoutines;
                afternoonRoutines = doc.data().afternoonRoutines;
                eveningRoutines = doc.data().eveningRoutines;
                saveState('routines-morning', morningRoutines);
                saveState('routines-afternoon', afternoonRoutines);
                saveState('routines-evening', eveningRoutines);
                renderRoutines();
                isSyncing = false;
            }
        });
    }

    // -------------------------------------------------------------
    // WATER TRACKER - Mis Vasitos 💧
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

    const syncWater = () => {
        if (firestoreAvailable) {
            db.collection('estudioflow').doc('water').set({ waterCount, waterTarget }, { merge: true });
        }
    };

    const renderWaterCups = () => {
        if (!waterCupsContainer) return;
        waterCupsContainer.innerHTML = '';
        for (let i = 0; i < waterTarget; i++) {
            const cup = document.createElement('button');
            cup.className = `water-cup ${i < waterCount ? 'filled' : ''}`;
            cup.innerHTML = `<i class="fa-solid fa-droplet cup-icon"></i>`;
            cup.addEventListener('click', () => setWaterCount(i + 1, true));
            waterCupsContainer.appendChild(cup);
        }
        if (waterCountDisplay) waterCountDisplay.textContent = waterCount;
        if (waterGoalDisplay) waterGoalDisplay.textContent = waterTarget;
        if (waterTargetBadge) waterTargetBadge.textContent = `Meta: ${waterTarget} vasos`;
        if (btnRemoveWater) btnRemoveWater.disabled = waterCount === 0;
    };

    const setWaterCount = (newCount, animate = true) => {
        const prevCount = waterCount;
        waterCount = Math.max(0, Math.min(newCount, waterTarget));
        saveState('studyflow-water-count', waterCount);
        syncWater();
        renderWaterCups();
        
        if (animate && waterCount > prevCount && waterCupsContainer) {
            const cups = waterCupsContainer.querySelectorAll('.water-cup');
            const newlyFilled = cups[waterCount - 1];
            if (newlyFilled) {
                newlyFilled.classList.add('splash');
                setTimeout(() => newlyFilled.classList.remove('splash'), 500);
            }
        }
        
        if (waterCount === waterTarget && waterCount > 0 && waterWidget) {
            waterWidget.classList.add('goal-reached');
            setTimeout(() => waterWidget.classList.remove('goal-reached'), 4500);
            addTerminalLine('system', `💧 ¡Felicidades! Meta de ${waterTarget} vasos alcanzada.`);
        }
    };

    if (btnAddWater) btnAddWater.addEventListener('click', () => {
        if (waterCount < waterTarget) setWaterCount(waterCount + 1, true);
        else addTerminalLine('system', `✅ ¡Ya alcanzaste tu meta de ${waterTarget} vasos!`);
    });
    if (btnRemoveWater) btnRemoveWater.addEventListener('click', () => setWaterCount(waterCount - 1, true));
    if (waterGoalSelect) {
        waterGoalSelect.value = String(waterTarget);
        waterGoalSelect.addEventListener('change', () => {
            waterTarget = parseInt(waterGoalSelect.value, 10);
            if (waterCount > waterTarget) waterCount = waterTarget;
            saveState('studyflow-water-target', waterTarget);
            saveState('studyflow-water-count', waterCount);
            syncWater();
            renderWaterCups();
            addTerminalLine('system', `🎯 Meta de agua: ${waterTarget} vasos por día`);
        });
    }
    renderWaterCups();

    if (firestoreAvailable) {
        db.collection('estudioflow').doc('water').onSnapshot((doc) => {
            if (doc.exists && !isSyncing && doc.data().waterCount !== undefined) {
                isSyncing = true;
                waterCount = doc.data().waterCount;
                waterTarget = doc.data().waterTarget;
                saveState('studyflow-water-count', waterCount);
                saveState('studyflow-water-target', waterTarget);
                if (waterGoalSelect) waterGoalSelect.value = String(waterTarget);
                renderWaterCups();
                isSyncing = false;
            }
        });
    }

    // -------------------------------------------------------------
    // POMODORO TIMER (simplificado)
    // -------------------------------------------------------------
    let timerInterval = null;
    let totalSeconds = 1500;
    let secondsLeft = 1500;
    let timerRunning = false;
    let completedPomodoros = loadState('completed-pomodoros', 0);

    const timeLeftEl = document.getElementById('time-left');
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
                    addTerminalLine('system', '✅ Pomodoro completado! Tómate un recreo.');
                }
                resetTimer();
                const alarmModal = document.getElementById('alarm-modal');
                if (alarmModal) alarmModal.classList.remove('hidden');
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

    const btnCloseModal = document.getElementById('btn-close-modal');
    const alarmModal = document.getElementById('alarm-modal');
    if (btnCloseModal && alarmModal) {
        btnCloseModal.addEventListener('click', () => {
            alarmModal.classList.add('hidden');
            if (bellSound) bellSound.pause();
        });
    }

    resetTimer();

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
    // TERMINAL
    // -------------------------------------------------------------
    const terminalInput = document.getElementById('terminal-input');
    if (terminalInput) {
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const cmd = terminalInput.value.trim().toLowerCase();
                if (cmd) {
                    addTerminalLine('input', cmd);
                    if (cmd === 'help') {
                        addTerminalLine('output', 'Comandos: help, clear, date, todo, rutina');
                    } else if (cmd === 'clear') {
                        const out = document.getElementById('terminal-output');
                        if (out) out.innerHTML = '';
                    } else if (cmd === 'date') {
                        addTerminalLine('output', new Date().toString());
                    } else if (cmd === 'todo') {
                        const pending = tasks.filter(t => !t.completed);
                        if (pending.length === 0) addTerminalLine('output', '✅ No hay tareas pendientes');
                        else pending.forEach(t => addTerminalLine('output', `📌 ${t.title} (${t.priority})`));
                    } else if (cmd === 'rutina') {
                        const total = morningRoutines.length + afternoonRoutines.length + eveningRoutines.length;
                        const completed = morningRoutines.filter(r => r.completed).length + afternoonRoutines.filter(r => r.completed).length + eveningRoutines.filter(r => r.completed).length;
                        addTerminalLine('output', `📊 Progreso de rutinas: ${completed}/${total} completadas (${Math.round(completed/total*100)}%)`);
                    } else {
                        addTerminalLine('output', `❌ Comando no reconocido: "${cmd}". Escribe "help"`);
                    }
                    terminalInput.value = '';
                }
            }
        });
    }

    // -------------------------------------------------------------
    // LOFI PLAYER
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
                addTerminalLine('system', '🎵 Lofi music activada');
            }).catch(() => {});
        };
        const stopLofi = () => {
            lofiAudio.pause();
            isLofiPlaying = false;
            btnLofiPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            if (lofiStatus) lofiStatus.textContent = 'Offline';
            addTerminalLine('system', '🎵 Lofi music detenida');
        };
        btnLofiPlay.addEventListener('click', () => isLofiPlaying ? stopLofi() : playLofi());
        if (lofiVolume) lofiVolume.addEventListener('input', (e) => lofiAudio.volume = e.target.value);
    }

    // Mensaje de bienvenida
    setTimeout(() => {
        if (firestoreAvailable) addTerminalLine('system', '🎉 Sincronización en tiempo real activa!');
        else addTerminalLine('system', '📁 Modo local - Firebase no conectado');
    }, 500);
});
