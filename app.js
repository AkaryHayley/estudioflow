/* ==========================================
   EstudioFlow JS - COMPLETO CON SINCRONIZACIÓN
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
    // FECHA
    // -------------------------------------------------------------
    const dateSpan = document.getElementById('current-date');
    if (dateSpan) {
        dateSpan.textContent = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // -------------------------------------------------------------
    // TAREAS (TASK MANAGER)
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
                addTerminalLine('system', '☁️ Tareas sincronizadas');
                isSyncing = false;
            }
        });
    }

    // -------------------------------------------------------------
    // RUTINAS DIARIAS
    // -------------------------------------------------------------
    const defaultMorning = [
        { id: 'm1', text: '🌅 Aseo personal', startTime: '08:00', endTime: '08:30', completed: false, processedByRoulette: false },
        { id: 'm2', text: '🥞 Desayuno tierno', startTime: '08:30', endTime: '09:15', completed: false, processedByRoulette: false },
        { id: 'm3', text: '🧘 Estiramientos', startTime: '09:15', endTime: '09:45', completed: false, processedByRoulette: false },
        { id: 'm4', text: '🎮 Tiempo libre', startTime: '09:45', endTime: '10:45', completed: false, processedByRoulette: false },
        { id: 'm5', text: '🎥 Grabar videos', startTime: '10:45', endTime: '11:45', completed: false, processedByRoulette: false },
        { id: 'm6', text: '🎨 Ocio creativo', startTime: '11:45', endTime: '12:30', completed: false, processedByRoulette: false }
    ];

    const defaultAfternoon = [
        { id: 'a1', text: '🍱 Almorzar', startTime: '12:30', endTime: '13:00', completed: false, processedByRoulette: false },
        { id: 'a2', text: '💻 Clases Virtuales', startTime: '13:00', endTime: '19:00', completed: false, processedByRoulette: false },
        { id: 'a3', text: '🙋 Participar activamente', startTime: '13:00', endTime: '19:00', completed: false, processedByRoulette: false },
        { id: 'a4', text: '📝 Anotar apuntes', startTime: '13:00', endTime: '19:15', completed: false, processedByRoulette: false }
    ];

    const defaultEvening = [
        { id: 'e1', text: '🌌 Cenar ligero', startTime: '19:15', endTime: '20:00', completed: false, processedByRoulette: false },
        { id: 'e2', text: '🧠 Repaso Pomodoro', startTime: '20:00', endTime: '21:00', completed: false, processedByRoulette: false },
        { id: 'e3', text: '✨ Skincare', startTime: '21:00', endTime: '21:45', completed: false, processedByRoulette: false },
        { id: 'e4', text: '📵 Desconexión digital', startTime: '22:00', endTime: '23:00', completed: false, processedByRoulette: false }
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
            morningRoutines = morningRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
            afternoonRoutines = afternoonRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
            eveningRoutines = eveningRoutines.map(r => ({ ...r, completed: false, processedByRoulette: false }));
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
                addTerminalLine('system', '☁️ Rutinas sincronizadas');
                isSyncing = false;
            }
        });
    }

    // -------------------------------------------------------------
    // WATER TRACKER - VASITOS
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
    // POMODORO TIMER
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

    const customMinutes = document.getElementById('custom-minutes');
    const btnSetCustom = document.getElementById('btn-set-custom');
    if (btnSetCustom && customMinutes) {
        btnSetCustom.addEventListener('click', () => {
            const mins = parseInt(customMinutes.value, 10);
            if (isNaN(mins) || mins < 1 || mins > 180) {
                alert('Minutos válidos: 1-180');
                return;
            }
            presetButtons.forEach(b => b.classList.remove('active'));
            totalSecondsPomo = mins * 60;
            secondsLeftPomo = totalSecondsPomo;
            if (timerStatusEl) timerStatusEl.textContent = `${mins}m`;
            resetPomodoro();
        });
    }

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
    // RULETA DE CASTIGOS
    // -------------------------------------------------------------
    let punishmentsList = [
        { id: 'p1', name: "Ahorro Obligatorio 💸", desc: "Depositar 5 Bs en tu frasco de ahorros", count: 0 },
        { id: 'p2', name: "Cardio Flash 🧘", desc: "Realizar 15 sentadillas suaves", count: 0 },
        { id: 'p3', name: "Desintoxicación Móvil 📵", desc: "1 hora sin mirar el celular", count: 0 },
        { id: 'p4', name: "Fuerza Gamer ⚡", desc: "Hacer 10 flexiones de pecho", count: 0 },
        { id: 'p5', name: "Orden Relámpago 🫧", desc: "Organizar tu escritorio 5 minutos", count: 0 },
        { id: 'p6', name: "Estiramiento Zen ☁️", desc: "5 minutos de estiramientos", count: 0 }
    ];

    const savedPunishments = localStorage.getItem('punishments-list');
    if (savedPunishments) {
        punishmentsList = JSON.parse(savedPunishments);
    }

    let currentRotationDeg = 0;
    let isSpinningRoulette = false;

    const wheelElement = document.getElementById('roulette-wheel');
    const spinButton = document.getElementById('btn-spin-roulette');
    const punishmentResult = document.getElementById('punishment-text');
    const resultCard = document.getElementById('punishment-result-card');
    const expiredCountSpan = document.getElementById('expired-count');
    const punishmentWidget = document.getElementById('punishment-widget');
    const ledgerList = document.getElementById('punishment-ledger-list');
    const btnAddCustom = document.getElementById('btn-add-custom-punishment');
    const newPunishmentName = document.getElementById('new-punishment-name');
    const newPunishmentDesc = document.getElementById('new-punishment-desc');

    const syncPunishments = () => {
        if (firestoreAvailable && !isSyncing) {
            db.collection('estudioflow').doc('punishments').set({
                punishmentsList: punishmentsList,
                lastUpdated: new Date().toISOString()
            }, { merge: true }).catch(err => console.error('Sync error:', err));
        }
    };

    const getExpiredTasks = () => {
        const currentMin = getCurrentMinutes();
        let expired = [];
        const checkRoutines = (routines, block) => {
            routines.forEach(r => {
                if (!r.completed && !r.processedByRoulette) {
                    const endMin = timeToMinutes(r.endTime);
                    if (currentMin > endMin) {
                        expired.push({ ...r, block });
                    }
                }
            });
        };
        checkRoutines(morningRoutines, 'morning');
        checkRoutines(afternoonRoutines, 'afternoon');
        checkRoutines(eveningRoutines, 'evening');
        return expired;
    };

    const updateExpiredCount = () => {
        const expired = getExpiredTasks();
        const totalPending = punishmentsList.reduce((sum, p) => sum + (p.count || 0), 0);
        if (expiredCountSpan) expiredCountSpan.textContent = expired.length;
        if (punishmentWidget) {
            if (expired.length > 0 || totalPending > 0) {
                punishmentWidget.classList.remove('hidden');
                if (spinButton) spinButton.disabled = expired.length === 0;
            } else {
                punishmentWidget.classList.add('hidden');
            }
        }
    };

    const renderRouletteWheel = () => {
        if (!wheelElement) return;
        wheelElement.innerHTML = '';
        const N = punishmentsList.length;
        if (N === 0) return;
        const sectorAngle = 360 / N;
        const colors = ['#fce7f3', '#e0f2fe', '#f3e8ff', '#fef9c3', '#ccfbf1', '#ffedd5', '#dbeafe', '#fae8ff'];
        let gradientParts = [];
        for (let i = 0; i < N; i++) {
            const color = colors[i % colors.length];
            const start = i * sectorAngle;
            const end = (i + 1) * sectorAngle;
            gradientParts.push(`${color} ${start}deg ${end}deg`);
        }
        wheelElement.style.background = `conic-gradient(${gradientParts.join(', ')})`;
        punishmentsList.forEach((p, i) => {
            const angle = (i * sectorAngle) + (sectorAngle / 2);
            const label = document.createElement('div');
            label.className = 'wheel-label';
            label.textContent = p.name.length > 12 ? p.name.substring(0, 10) + '…' : p.name;
            label.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-75px)`;
            wheelElement.appendChild(label);
        });
    };

    const renderPunishmentLedger = () => {
        if (!ledgerList) return;
        ledgerList.innerHTML = '';
        if (punishmentsList.length === 0) {
            ledgerList.innerHTML = '<li class="ledger-empty-item">No hay castigos creados</li>';
            return;
        }
        punishmentsList.forEach(p => {
            const count = p.count || 0;
            const li = document.createElement('li');
            li.className = 'ledger-item';
            li.innerHTML = `
                <div class="ledger-item-info">
                    <span class="ledger-item-name">${escapeHTML(p.name)}</span>
                    <span class="ledger-item-badge ${count > 0 ? 'pending' : 'clear'}">
                        ${count > 0 ? `Pendientes: ${count}` : '✓ Al día'}
                    </span>
                </div>
                <div class="ledger-item-actions">
                    <button class="btn-ledger-add" data-id="${p.id}">➕</button>
                    <button class="btn-ledger-deduct" data-id="${p.id}" ${count === 0 ? 'disabled' : ''}>✅</button>
                </div>
            `;
            li.querySelector('.btn-ledger-add').addEventListener('click', () => {
                p.count = (p.count || 0) + 1;
                localStorage.setItem('punishments-list', JSON.stringify(punishmentsList));
                syncPunishments();
                renderPunishmentLedger();
                updateExpiredCount();
                addTerminalLine('system', `➕ Añadiste castigo: "${p.name}" (total: ${p.count})`);
            });
            li.querySelector('.btn-ledger-deduct').addEventListener('click', () => {
                if (p.count > 0) {
                    p.count--;
                    localStorage.setItem('punishments-list', JSON.stringify(punishmentsList));
                    syncPunishments();
                    renderPunishmentLedger();
                    updateExpiredCount();
                    addTerminalLine('system', `✅ Completaste castigo: "${p.name}" (restan: ${p.count})`);
                }
            });
            ledgerList.appendChild(li);
        });
    };

    const spinRouletteWheel = () => {
        if (isSpinningRoulette) return;
        const expiredTasks = getExpiredTasks();
        if (expiredTasks.length === 0) {
            addTerminalLine('system', '✨ No hay tareas expiradas para procesar');
            return;
        }
        const targetTask = expiredTasks[0];
        isSpinningRoulette = true;
        if (spinButton) spinButton.disabled = true;
        const N = punishmentsList.length;
        const selectedIndex = Math.floor(Math.random() * N);
        const sectorAngle = 360 / N;
        const targetAngle = 360 - ((selectedIndex * sectorAngle) + (sectorAngle / 2));
        const spins = 8 + Math.floor(Math.random() * 4);
        const newRotation = currentRotationDeg + (360 * spins) + targetAngle;
        currentRotationDeg = newRotation;
        wheelElement.style.transition = 'transform 3.5s cubic-bezier(0.2, 0.9, 0.1, 1.1)';
        wheelElement.style.transform = `rotate(${currentRotationDeg}deg)`;
        addTerminalLine('system', `🎰 Girando ruleta por: "${targetTask.text}"...`);
        setTimeout(() => {
            const selected = punishmentsList[selectedIndex];
            selected.count = (selected.count || 0) + 1;
            localStorage.setItem('punishments-list', JSON.stringify(punishmentsList));
            syncPunishments();
            if (targetTask.block === 'morning') {
                const idx = morningRoutines.findIndex(r => r.id === targetTask.id);
                if (idx !== -1) morningRoutines[idx].processedByRoulette = true;
                localStorage.setItem('routines-morning', JSON.stringify(morningRoutines));
            } else if (targetTask.block === 'afternoon') {
                const idx = afternoonRoutines.findIndex(r => r.id === targetTask.id);
                if (idx !== -1) afternoonRoutines[idx].processedByRoulette = true;
                localStorage.setItem('routines-afternoon', JSON.stringify(afternoonRoutines));
            } else if (targetTask.block === 'evening') {
                const idx = eveningRoutines.findIndex(r => r.id === targetTask.id);
                if (idx !== -1) eveningRoutines[idx].processedByRoulette = true;
                localStorage.setItem('routines-evening', JSON.stringify(eveningRoutines));
            }
            renderAllRoutines();
            renderPunishmentLedger();
            updateExpiredCount();
            if (punishmentResult && resultCard) {
                punishmentResult.innerHTML = `<strong>${selected.name}</strong><br>${selected.desc}<br><span style="color: var(--secondary);">Acumulado: ${selected.count}</span>`;
                resultCard.classList.remove('hidden');
                setTimeout(() => resultCard.classList.add('hidden'), 5000);
            }
            addTerminalLine('system', `⚠️ Castigo: "${selected.name}" por "${targetTask.text}"`);
            isSpinningRoulette = false;
            if (spinButton) spinButton.disabled = false;
        }, 3500);
    };

    if (spinButton) spinButton.addEventListener('click', spinRouletteWheel);

    if (btnAddCustom) {
        btnAddCustom.addEventListener('click', () => {
            const name = newPunishmentName?.value.trim();
            const desc = newPunishmentDesc?.value.trim() || "Castigo personalizado";
            if (!name) { alert('Ingresa un nombre para el castigo'); return; }
            if (punishmentsList.length >= 10) { alert('Máximo 10 castigos en la ruleta'); return; }
            punishmentsList.push({ id: 'custom-' + Date.now(), name: name, desc: desc, count: 0 });
            localStorage.setItem('punishments-list', JSON.stringify(punishmentsList));
            syncPunishments();
            renderRouletteWheel();
            renderPunishmentLedger();
            updateExpiredCount();
            if (newPunishmentName) newPunishmentName.value = '';
            if (newPunishmentDesc) newPunishmentDesc.value = '';
            addTerminalLine('system', `🎰 Nuevo castigo añadido: "${name}"`);
        });
    }

    renderRouletteWheel();
    renderPunishmentLedger();
    updateExpiredCount();

    if (firestoreAvailable) {
        db.collection('estudioflow').doc('punishments').onSnapshot((doc) => {
            if (doc.exists && !isSyncing && doc.data().punishmentsList) {
                isSyncing = true;
                punishmentsList = doc.data().punishmentsList;
                localStorage.setItem('punishments-list', JSON.stringify(punishmentsList));
                renderRouletteWheel();
                renderPunishmentLedger();
                updateExpiredCount();
                addTerminalLine('system', '☁️ Castigos sincronizados');
                isSyncing = false;
            }
        });
    }

    // -------------------------------------------------------------
    // SISTEMA DE NOTAS
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
        } catch (error) {
            console.error('Error saving notebooks:', error);
            updateSyncStatus('offline');
        }
    };

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

    const saveCurrentNotebookContent = async () => {
        const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
        if (activeNb && noteArea && activeNb.content !== noteArea.value) {
            activeNb.content = noteArea.value;
            saveState('studyflow-notebooks-list', notebooks);
            if (firestoreAvailable) await saveNotebooksToFirebase();
            return true;
        }
        return false;
    };

    const loadActiveNotebook = () => {
        const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
        if (activeNb && noteArea) noteArea.value = activeNb.content || '';
        if (activeTitleInput && activeNb) activeTitleInput.value = activeNb.title;
    };

    let autosaveTimeout = null;
    const triggerAutosave = () => {
        if (autosaveStatus) autosaveStatus.textContent = "Guardando...";
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(async () => {
            await saveCurrentNotebookContent();
            if (autosaveStatus) autosaveStatus.textContent = "✓ Guardado";
            setTimeout(() => { if (autosaveStatus) autosaveStatus.textContent = "Listo"; }, 1000);
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

    if (noteArea) noteArea.addEventListener('input', triggerAutosave);
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
            setTimeout(() => btnSaveNote.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar', 1500);
            addTerminalLine('system', '📝 Notas guardadas y sincronizadas');
        });
    }
    if (btnClearNote && noteArea) {
        btnClearNote.addEventListener('click', async () => {
            const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
            if (confirm(`¿Borrar apuntes de "${activeNb?.title}"?`)) {
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

    loadNotebooksFromLocal();
    renderNotebooksSidebar();
    loadActiveNotebook();

    if (firestoreAvailable) {
        db.collection('estudioflow').doc('notebooks').onSnapshot((doc) => {
            if (doc.exists && !isSyncing && doc.data().notebooks) {
                const data = doc.data();
                if (JSON.stringify(notebooks) !== JSON.stringify(data.notebooks)) {
                    isSyncing = true;
                    notebooks = data.notebooks;
                    activeNotebookId = data.activeNotebookId;
                    saveState('studyflow-notebooks-list', notebooks);
                    localStorage.setItem('studyflow-active-notebook-id', activeNotebookId);
                    renderNotebooksSidebar();
                    loadActiveNotebook();
                    addTerminalLine('system', '☁️ Notas sincronizadas');
                    isSyncing = false;
                }
            }
        });
    }

    // -------------------------------------------------------------
    // NAVEGACIÓN TABS
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
        [navDash, navTask, navPomo, navNote, navRoutine].forEach(n => { if (n) n.classList.remove('active'); });
        if (active) active.classList.add('active');
    };

    if (navDash) navDash.addEventListener('click', (e) => { e.preventDefault(); setActive(navDash); switchSection('dashboard'); });
    if (navNote) navNote.addEventListener('click', (e) => { e.preventDefault(); setActive(navNote); switchSection('notes'); });
    if (navRoutine) navRoutine.addEventListener('click', (e) => { e.preventDefault(); setActive(navRoutine); switchSection('routines'); });
    if (navTask) navTask.addEventListener('click', (e) => { e.preventDefault(); setActive(navTask); switchSection('dashboard'); document.querySelector('.widget-tasks')?.scrollIntoView({ behavior: 'smooth' }); });
    if (navPomo) navPomo.addEventListener('click', (e) => { e.preventDefault(); setActive(navPomo); switchSection('dashboard'); document.querySelector('.widget-pomodoro')?.scrollIntoView({ behavior: 'smooth' }); });

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
                    terminalInput.value = '';
                }
            }
        });
    }

    // -------------------------------------------------------------
    // LOFI PLAYER
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
        if (lofiStation) lofiStation.addEventListener('change', () => { if (lofiActive) { stopLofiStation(); setTimeout(playLofiStation, 100); } });
    }

    // Mensaje final
    setTimeout(() => {
        addTerminalLine('system', firestoreAvailable ? '🎉 Sincronización en tiempo real activa!' : '📁 Modo local - Firebase no conectado');
    }, 500);

    // Exponer funciones para debugging
    window.renderAllRoutines = renderAllRoutines;
    window.punishmentsList = punishmentsList;
});
