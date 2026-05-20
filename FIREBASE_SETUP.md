# 🚀 Guía: Sincronización en Tiempo Real con Firebase

**¡Felicidades!** Ya tienes Firebase configurado. Ahora activaremos la sincronización en tiempo real para que tus datos se compartan entre dispositivos automáticamente. ☁️✨

---

## 📋 Tabla de Contenidos
1. [Archivo firebase-sync.js](#archivo-creado)
2. [Modificaciones en index.html](#paso-1-indexhtml)
3. [Modificaciones en app.js](#paso-2-appjs)
4. [Configuración de Firebase Reglas](#paso-3-firebase-reglas)

---

## ✅ Archivo Creado

He creado **`firebase-sync.js`** que:
- Autentica usuarios de forma anónima
- Escucha cambios en tareas, apuntes y agua
- Guarda datos en la nube
- Sincroniza automáticamente entre dispositivos

---

## Paso 1: Modificar `index.html`

Después de `<script src="app.js"></script>`, **AGREGA**:

```html
<script type="module" src="firebase-sync.js"></script>
```

---

## Paso 2: Modificar `app.js`

### En la función `toggleTask()` (línea ~319):

**REEMPLAZA:**
```javascript
const toggleTask = (id) => {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveState('tasks-list', tasks);
    renderTasks();
};
```

**CON:**
```javascript
const toggleTask = (id) => {
    tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveState('tasks-list', tasks);
    const task = tasks.find(t => t.id === id);
    if (task) import('./firebase-sync.js').then(m => m.saveTask(task));
    renderTasks();
};
```

### En la función `addTask()` (línea ~331):

**DESPUÉS de `saveState('tasks-list', tasks);` AGREGA:**
```javascript
if (newTask) import('./firebase-sync.js').then(m => m.saveTask(newTask));
```

### En la función `deleteTask()` (línea ~325):

**DESPUÉS de `saveState('tasks-list', tasks);` AGREGA:**
```javascript
import('./firebase-sync.js').then(m => m.deleteTask(id));
```

### En `setWaterCount()` (línea ~1407):

**DESPUÉS de `saveState('studyflow-water-count', waterCount);` AGREGA:**
```javascript
import('./firebase-sync.js').then(m => m.updateWaterData({
    count: waterCount,
    target: waterTarget
}));
```

---

## Paso 3: Configurar Reglas de Firebase

1. Abre [Firebase Console](https://console.firebase.google.com/)
2. Proyecto: **estudioflow-db**
3. **Firestore Database** → **Reglas**
4. **REEMPLAZA TODO CON:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

5. Clic en **"Publicar"**

---

## 🎯 ¡Listo!

Ahora cuando modifiques un vaso de agua en el celular, **aparecerá en tiempo real en la laptop** ☁️✨
