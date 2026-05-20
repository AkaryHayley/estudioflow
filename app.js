/* ==========================================
   EstudioFlow JS - COMPLETO
   Con Rutinas, Hora, Vasitos, Tareas, Pomodoro
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // INICIAR FIREBASE (si está disponible)
    // -------------------------------------------------------------
    let db = window.db || null;
    let firestoreAvailable = !!db;
    let isSyncing = false;
    
    console.log('Firestore disponible:', firestoreAvailable);
    
    // Helpers
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
    // 1. FECHA Y RELOJ
    // -------------------------------------------------------------
    const dateSpan = document.getElementById('current-date');
    if (dateSpan) {
        dateSpan.textContent = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
    
    const realtimeClockEl = document.getElementById('realtime-clock-display');
    if (realtimeClockEl) {
        const updateClock = () => {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            realtimeClockEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
        };
        updateClock();
        setInterval(updateClock, 1000);
    }
    
    // -------------------------------------------------------------
    // 2. TAREAS (TASK MANAGER)
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
    
    const updateTaskStats = () => {
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
            li.querySelector('.task-checkbox').addEventListener('click', () => {
                task.completed = !task.completed;
                saveState('tasks-list', tasks);
                renderTasks();
                if (firestoreAvailable) db.collection('estudioflow').doc('tasks').set({ tasks }, { merge: true });
            });
            li.querySelector('.btn-delete-task').addEventListener('click', () => {
                tasks = tasks.filter(t => t.id !== task.id);
                saveState('tasks-list', tasks);
                renderTasks();
                if (firestoreAvailable) db.collection('estudioflow').doc('tasks').set({ tasks }, { merge: true });
            });
            taskListEl.appendChild(li);
        });
        updateTaskStats();
    };
    
    const addNewTask = () => {
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
    
    if (btnAddTask) btnAddTask.addEventListener('click', addNewTask);
    if (inputTaskTitle) inputTaskTitle.addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewTask(); });
    
    renderTasks();
    
    // Suscribir tareas a Firebase
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
    // 3. RUTINAS DIARIAS (COMPLETO)
    // -------------------------------------------------------------
    const defaultMorning = [
        { id: 'm1', text: '🌅 Aseo personal', startTime: '08:00', endTime: '08:30', completed: false },
        { id: 'm2', text: '🥞 Desayuno tierno', startTime: '08:30', endTime: '09:15', completed: false },
        { id: 'm3', text: '🧘 Estiramientos', startTime: '09:15', endTime: '09:45', completed: false },
        { id: 'm4', text: '🎮 Tiempo libre', startTime: '09:45', endTime: '10:45', completed: false },
        { id: 'm5', text: '🎥 Grabar videos', startTime: '10:45', endTime: '11:45', completed: false },
        { id: 'm6', text: '🎨 Ocio creativo', startTime: '11:45', endTime: '12:30', completed: false }
    ];
    
    const defaultAfternoon = [
        { id: 'a1', text: '🍱 Almorzar', startTime: '12:30', endTime: '13:00', completed: false },
        { id: 'a2', text: '💻 Clases Virtuales', startTime: '13:00', endTime: '19:00', completed: false },
        { id: 'a3', text: '🙋 Participar activamente', startTime: '13:00', endTime: '19:00', completed: false },
        { id: 'a4', text: '📝 Anotar apuntes', startTime: '13:00', endTime: '19:15', completed: false }
    ];
    
    const defaultEvening = [
        { id: 'e1', text: '🌌 Cenar ligero', startTime: '19:15', endTime: '20:00', completed: false },
        { id: 'e2', text: '🧠 Repaso Pomodoro', startTime: '20:00', endTime: '21:00', completed: false },
        { id: 'e3', text: '✨ Skincare', startTime: '21:00', endTime: '21:45', completed: false },
        { id: 'e4', text: '📵 Desconexión digital', startTime: '22:00', endTime: '23:00', completed: false }
    ];
    
    let morningRoutines = loadState('routines-morning', defaultMorning);
    let afternoonRoutines = loadState('routines-afternoon', defaultAfternoon);
    let eveningRoutines = loadState('routines-evening', defaultEvening);
    
    const timeToMinutes = (t) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };
    
    const getCurrentMinutes = () => {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    };
    
    const renderAllRoutines = () => {
        const morningContainer = document.getElementById('morning-routine-list');
        const afternoonContainer = document.getElementById('afternoon-routine-list');
        const eveningContainer = document.getElementById('evening-routine-list');
        
        const currentMin = getCurrentMinutes();
        
        const renderRoutineList = (container, routines) => {
            if (!container) return;
            container.innerHTML = '';
            routines.forEach(item => {
                const startMin = timeToMinutes(item.startTime);
                const endMin = timeToMinutes(item.endTime);
                let statusClass = '';
                let statusText = '';
                let canComplete = true;
                
                if (item.completed) {
                    statusClass = 'completed';
                    statusText = '✓ Completada';
                    canComplete = false;
                } else if (currentMin < startMin) {
                    statusClass = 'locked';
                    statusText = `🔒 ${item.startTime}`;
                    canComplete = false;
                } else if (currentMin > endMin) {
                    statusClass = 'expired';
                    statusText = '⚠️ Expirada';
                    canComplete = false;
                } else {
                    statusClass = 'active';
                    statusText = `🕐 ${item.startTime} - ${item.endTime}`;
                    canComplete = true;
                }
                
                const li = document.createElement('li');
                li.className = `routine-item ${statusClass}`;
                li.innerHTML = `
                    <div class="routine-checkbox">${item.completed ? '<i class="fa-solid fa-check"></i>' : ''}</div>
                    <span class="routine-title">${escapeHTML(item.text)}</span>
                    <span class="routine-time-badge ${statusClass}">${statusText}</span>
                `;
                
                if (canComplete) {
                    li.style.cursor = 'pointer';
                    li.addEventListener('click', () => {
                        item.completed = true;
                        saveState('routines-morning', morningRoutines);
                        saveState('routines-afternoon', afternoonRoutines);
                        saveState('routines-evening', eveningRoutines);
                        if (firestoreAvailable) {
                            db.collection('estudioflow').doc('routines').set({ morningRoutines, afternoonRoutines, eveningRoutines }, { merge: true });
                        }
                        renderAllRoutines();
                        addTerminalLine('system', `✅ Completaste: "${item.text}"`);
                    });
                }
                
                container.appendChild(li);
            });
        };
        
        renderRoutineList(morningContainer, morningRoutines);
        renderRoutineList(afternoonContainer, afternoonRoutines);
        renderRoutineList(eveningContainer, eveningRoutines);
    };
    
    renderAllRoutines();
    
    // Botón reiniciar rutinas
    const btnResetRoutines = document.getElementById('btn-reset-routines');
    if (btnResetRoutines) {
        btnResetRoutines.addEventListener('click', () => {
            morningRoutines = morningRoutines.map(r => ({ ...r, completed: false }));
            afternoonRoutines = afternoonRoutines.map(r => ({ ...r, completed: false }));
            eveningRoutines = eveningRoutines.map(r => ({ ...r, completed: false }));
            saveState('routines-morning', morningRoutines);
            saveState('routines-afternoon', afternoonRoutines);
            saveState('routines-evening', eveningRoutines);
            if (firestoreAvailable) {
                db.collection('estudioflow').doc('routines').set({ morningRoutines, afternoonRoutines, eveningRoutines }, { merge: true });
            }
            renderAllRoutines();
            addTerminalLine('system', '🔄 Todas las rutinas han sido reiniciadas');
        });
    }
    
    // Suscribir rutinas a Firebase
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
                renderAllRoutines();
                isSyncing = false;
            }
        });
    }
    
    // -------------------------------------------------------------
    // 4. WATER TRACKER - VASITOS 💧
    // -------------------------------------------------------------
    let waterCount = loadState('studyflow-water-count', 0);
    let waterTarget = loadState('studyflow-water-target', 6);
    
    const waterContainer = document.getElementById('water-cups-container');
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
        if (!waterContainer) return;
        waterContainer.innerHTML = '';
        for (let i = 0; i < waterTarget; i++) {
            const cup = document.createElement('button');
            cup.className = `water-cup ${i < waterCount ? 'filled' : ''}`;
            cup.innerHTML = `<i class="fa-solid fa-droplet cup-icon"></i>`;
            cup.addEventListener('click', () => {
                const newCount = i + 1;
                if (waterCount >= newCount) {
                    waterCount = newCount - 1;
                } else {
                    waterCount = newCount;
                }
                waterCount = Math.max(0, Math.min(waterCount, waterTarget));
                saveState('studyflow-water-count', waterCount);
                syncWater();
                renderWaterCups();
                if (waterCount === waterTarget && waterCount > 0 && waterWidget) {
                    waterWidget.classList.add('goal-reached');
                    setTimeout(() => waterWidget.classList.remove('goal-reached'), 3000);
                    addTerminalLine('system', `💧 ¡Meta de ${waterTarget} vasos alcanzada!`);
                }
            });
            waterContainer.appendChild(cup);
        }
        if (waterCountDisplay) waterCountDisplay.textContent = waterCount;
        if (waterGoalDisplay) waterGoalDisplay.textContent = waterTarget;
        if (waterTargetBadge) waterTargetBadge.textContent = `Meta: ${waterTarget} vasos`;
        if (btnRemoveWater) btnRemoveWater.disabled = waterCount === 0;
    };
    
    if (btnAddWater) {
        btnAddWater.addEventListener('click', () => {
            if (waterCount < waterTarget) {
                waterCount++;
                saveState('studyflow-water-count', waterCount);
                syncWater();
                renderWaterCups();
                addTerminalLine('system', `💧 Tomaste un vaso (${waterCount}/${waterTarget})`);
            }
        });
    }
    
    if (btnRemoveWater) {
        btnRemoveWater.addEventListener('click', () => {
            if (waterCount > 0) {
                waterCount--;
                saveState('studyflow-water-count', waterCount);
                syncWater();
                renderWaterCups();
            }
        });
    }
    
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
    // 5. POMODORO TIMER
    // -------------------------------------------------------------
    let totalSecondsPomo = 1500;
    let secondsLeftPomo = 1500;
    let pomodoroRunning = false;
    let pomodoroInterval = null;
    let completedPomodoros = loadState('completed-pomodoros', 0);
    
    const timeLeftEl = document.getElementById('time-left');
    const timerStatusEl = document.getElementById('timer-status');
    const btnStart = document.getElementById('btn-timer-start');
    const btnPause = document.getElementById('btn-timer-pause');
    const btnReset = document.getElementById('btn-timer-reset');
    const statPomodorosEl = document.getElementById('stat-completed-pomodoros');
    const bellSound = document.getElementById('bell-sound');
    
    if (statPomodorosEl) statPomodorosEl.textContent = completedPomodoros;
    
    const updatePomoDisplay = () => {
        if (!timeLeftEl) return;
        const mins = Math.floor(secondsLeftPomo / 60);
        const secs = secondsLeftPomo % 60;
        timeLeftEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const startPomodoro = () => {
        if (pomodoroRunning) return;
        pomodoroRunning = true;
        if (btnStart) btnStart.disabled = true;
        if (btnPause) btnPause.disabled = false;
        pomodoroInterval = setInterval(() => {
            if (secondsLeftPomo > 0) {
                secondsLeftPomo--;
                updatePomoDisplay();
            } else {
                clearInterval(pomodoroInterval);
                if (bellSound) bellSound.play();
                if (totalSecondsPomo === 1500) {
                    completedPomodoros++;
                    if (statPomodorosEl) statPomodorosEl.textContent = completedPomodoros;
                    saveState('completed-pomodoros', completedPomodoros);
                    addTerminalLine('system', '✅ Pomodoro completado!');
                }
                resetPomodoro();
                const modal = document.getElementById('alarm-modal');
                if (modal) modal.classList.remove('hidden');
            }
        }, 1000);
    };
    
    const pausePomodoro = () => {
        if (!pomodoroRunning) return;
        pomodoroRunning = false;
        clearInterval(pomodoroInterval);
        if (btnStart) btnStart.disabled = false;
        if (btnPause) btnPause.disabled = true;
    };
    
    const resetPomodoro = () => {
        pausePomodoro();
        secondsLeftPomo = totalSecondsPomo;
        updatePomoDisplay();
        if (btnPause) btnPause.disabled = true;
    };
    
    if (btnStart) btnStart.addEventListener('click', startPomodoro);
    if (btnPause) btnPause.addEventListener('click', pausePomodoro);
    if (btnReset) btnReset.addEventListener('click', resetPomodoro);
    
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            totalSecondsPomo = parseInt(btn.dataset.time, 10);
            secondsLeftPomo = totalSecondsPomo;
            if (timerStatusEl) {
                if (totalSecondsPomo === 1500) timerStatusEl.textContent = "Foco";
                else if (totalSecondsPomo === 300) timerStatusEl.textContent = "Corto";
                else timerStatusEl.textContent = "Largo";
            }
            resetPomodoro();
        });
    });
    
    resetPomodoro();
    
    const closeModalBtn = document.getElementById('btn-close-modal');
    const alarmModal = document.getElementById('alarm-modal');
    if (closeModalBtn && alarmModal) {
        closeModalBtn.addEventListener('click', () => {
            alarmModal.classList.add('hidden');
            if (bellSound) bellSound.pause();
        });
    }
    
    // -------------------------------------------------------------
    // 6. TERMINAL
    // -------------------------------------------------------------
    const terminalInputField = document.getElementById('terminal-input');
    if (terminalInputField) {
        terminalInputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const cmd = terminalInputField.value.trim().toLowerCase();
                if (cmd) {
                    addTerminalLine('input', cmd);
                    if (cmd === 'help') {
                        addTerminalLine('output', 'Comandos: help, clear, date, todo, rutina, agua');
                    } else if (cmd === 'clear') {
                        const out = document.getElementById('terminal-output');
                        if (out) out.innerHTML = '';
                    } else if (cmd === 'date') {
                        addTerminalLine('output', new Date().toString());
                    } else if (cmd === 'todo') {
                        const pending = tasks.filter(t => !t.completed);
                        if (pending.length === 0) addTerminalLine('output', '✅ No hay tareas pendientes');
                        else pending.forEach(t => addTerminalLine('output', `📌 ${t.title}`));
                    } else if (cmd === 'rutina') {
                        const total = morningRoutines.length + afternoonRoutines.length + eveningRoutines.length;
                        const comp = morningRoutines.filter(r => r.completed).length + afternoonRoutines.filter(r => r.completed).length + eveningRoutines.filter(r => r.completed).length;
                        addTerminalLine('output', `📊 Rutinas: ${comp}/${total} completadas`);
                    } else if (cmd === 'agua') {
                        addTerminalLine('output', `💧 Agua: ${waterCount}/${waterTarget} vasos`);
                    } else {
                        addTerminalLine('output', `❌ Comando no reconocido: "${cmd}"`);
                    }
                    terminalInputField.value = '';
                }
            }
        });
    }
    
    // -------------------------------------------------------------
    // 7. LOFI PLAYER
    // -------------------------------------------------------------
    const lofiAudio = document.getElementById('lofi-audio');
    const lofiPlayBtn = document.getElementById('btn-lofi-play');
    const lofiStation = document.getElementById('lofi-station-select');
    const lofiVol = document.getElementById('lofi-volume');
    const lofiStatusSpan = document.getElementById('lofi-status');
    let lofiActive = false;
    
    if (lofiAudio && lofiPlayBtn) {
        if (lofiVol) lofiAudio.volume = parseFloat(lofiVol.value);
        const playLofiStation = () => {
            if (lofiActive) return;
            if (lofiStation) lofiAudio.src = lofiStation.value;
            lofiAudio.load();
            lofiAudio.play().then(() => {
                lofiActive = true;
                lofiPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                if (lofiStatusSpan) lofiStatusSpan.textContent = 'Online';
                addTerminalLine('system', '🎵 Lofi music activada');
            }).catch(() => {});
        };
        const stopLofiStation = () => {
            lofiAudio.pause();
            lofiActive = false;
            lofiPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            if (lofiStatusSpan) lofiStatusSpan.textContent = 'Offline';
            addTerminalLine('system', '🎵 Lofi music detenida');
        };
        lofiPlayBtn.addEventListener('click', () => lofiActive ? stopLofiStation() : playLofiStation());
        if (lofiVol) lofiVol.addEventListener('input', (e) => lofiAudio.volume = e.target.value);
    }
    
    // -------------------------------------------------------------
    // 8. NAVEGACIÓN POR TABS
    // -------------------------------------------------------------
    const navDash = document.getElementById('nav-dashboard');
    const navTask = document.getElementById('nav-tasks');
    const navPomo = document.getElementById('nav-timer');
    const navNote = document.getElementById('nav-notes');
    const navRoutine = document.getElementById('nav-routines');
    const secDash = document.getElementById('section-dashboard');
    const secRoutine = document.getElementById('section-routines');
    const secNote = document.getElementById('section-notes');
    
    const switchSection = (section) => {
        if (secDash) secDash.classList.add('hidden');
        if (secRoutine) secRoutine.classList.add('hidden');
        if (secNote) secNote.classList.add('hidden');
        if (section === 'dashboard' && secDash) secDash.classList.remove('hidden');
        if (section === 'routines' && secRoutine) secRoutine.classList.remove('hidden');
        if (section === 'notes' && secNote) secNote.classList.remove('hidden');
    };
    
    const setActive = (active) => {
        [navDash, navTask, navPomo, navNote, navRoutine].forEach(n => {
            if (n) n.classList.remove('active');
        });
        if (active) active.classList.add('active');
    };
    
    if (navDash) navDash.addEventListener('click', (e) => { e.preventDefault(); setActive(navDash); switchSection('dashboard'); });
    if (navNote) navNote.addEventListener('click', (e) => { e.preventDefault(); setActive(navNote); switchSection('notes'); });
    if (navRoutine) navRoutine.addEventListener('click', (e) => { e.preventDefault(); setActive(navRoutine); switchSection('routines'); });
    if (navTask) navTask.addEventListener('click', (e) => { e.preventDefault(); setActive(navTask); switchSection('dashboard'); document.querySelector('.widget-tasks')?.scrollIntoView({ behavior: 'smooth' }); });
    if (navPomo) navPomo.addEventListener('click', (e) => { e.preventDefault(); setActive(navPomo); switchSection('dashboard'); document.querySelector('.widget-pomodoro')?.scrollIntoView({ behavior: 'smooth' }); });
    
    // Mensaje final
    setTimeout(() => {
        addTerminalLine('system', firestoreAvailable ? '🎉 Sincronización en tiempo real activa!' : '📁 Modo local - Firebase no conectado');
    }, 500);
});
