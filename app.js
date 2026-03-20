// app.js

// --- DATABASE SIMULATION (LocalStorage) ---
const DB = {
    getStudents: () => JSON.parse(localStorage.getItem('escola_alunos') || '[]'),
    saveStudents: (data) => localStorage.setItem('escola_alunos', JSON.stringify(data)),
    getTasks: () => JSON.parse(localStorage.getItem('escola_tarefas') || '[]'),
    saveTasks: (data) => localStorage.setItem('escola_tarefas', JSON.stringify(data)),
    getClasses: () => JSON.parse(localStorage.getItem('escola_classes') || '[]'),
    saveClasses: (data) => localStorage.setItem('escola_classes', JSON.stringify(data)),

    addStudent: (student) => {
        const students = DB.getStudents();
        students.push(student);
        DB.saveStudents(students);
    },
    updateStudent: (updatedStudent) => {
        let students = DB.getStudents();
        students = students.map(s => s.id === updatedStudent.id ? updatedStudent : s);
        DB.saveStudents(students);
    },
    deleteStudent: (id) => {
        let students = DB.getStudents();
        students = students.filter(s => s.id !== id);
        DB.saveStudents(students);
        // Cascading delete
        let tasks = DB.getTasks().filter(t => t.studentId !== id);
        DB.saveTasks(tasks);
    },

    addTask: (task) => {
        const tasks = DB.getTasks();
        tasks.push(task);
        DB.saveTasks(tasks);
    },
    updateTask: (updatedTask) => {
        let tasks = DB.getTasks();
        tasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
        DB.saveTasks(tasks);
    },
    deleteTask: (id) => {
        let tasks = DB.getTasks();
        tasks = tasks.filter(t => t.id !== id);
        DB.saveTasks(tasks);
    },

    getStudentTasks: (studentId) => {
        return DB.getTasks().filter(t => t.studentId === studentId);
    },

    clearAll: () => {
        localStorage.removeItem('escola_alunos');
        localStorage.removeItem('escola_tarefas');
        localStorage.removeItem('escola_classes');
    }
};

// --- STATE & UTILS ---
let currentStudentId = null;
let currentMonth = new Date().toISOString().slice(0, 7); // Default to current YYYY-MM
document.getElementById("global-month-filter").value = currentMonth;
document.getElementById("global-month-filter").addEventListener("change", (e) => {
    currentMonth = e.target.value;
    renderStudents();
    if (document.getElementById("view-student-details").classList.contains("active")) {
        renderTasks();
    }
    if (document.getElementById("view-reports").classList.contains("active")) {
        renderReports();
    }
});

const showToast = (msg, type = "success") => {
    const toast = document.getElementById("toast");
    toast.innerText = msg;
    toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--primary)';
    toast.classList.add("active");
    setTimeout(() => {
        toast.classList.remove("active");
    }, 3000);
};

const calcGradeValue = (val) => {
    if (!val) return null;
    val = val.toString().trim().toUpperCase().replace(',', '.');
    if (val === 'A' || val === 'MB') return 10;
    if (val === 'B' || val === 'BOM') return 8;
    if (val === 'C' || val === 'REG') return 6;
    if (val === 'D') return 4;
    const num = parseFloat(val);
    if (!isNaN(num)) return num;
    return null;
};

const getStudentMetrics = (studentId) => {
    let tasks = DB.getStudentTasks(studentId);
    if (currentMonth) {
        tasks = tasks.filter(t => t.date.startsWith(currentMonth));
    }
    let completed = 0;
    let sum = 0;
    let countGrades = 0;

    tasks.forEach(t => {
        if (t.status === 'concluido') completed++;
        const val = calcGradeValue(t.grade);
        if (val !== null) {
            sum += val;
            countGrades++;
        }
    });

    const avg = countGrades > 0 ? sum.toFixed(1) : '-';
    return {
        total: tasks.length,
        completed,
        pending: tasks.length - completed,
        avg
    };
};

// --- APP LOGIC ---

// Theme
const initTheme = () => {
    const theme = localStorage.getItem("escola_theme") || "light";
    setTheme(theme);
};

const setTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("escola_theme", theme);
    
    // Update theme selector buttons
    document.querySelectorAll(".theme-btn").forEach(btn => {
        btn.classList.toggle("active-theme", btn.dataset.setTheme === theme);
    });
};

document.querySelectorAll("[data-set-theme]").forEach(btn => {
    btn.addEventListener('click', () => setTheme(btn.dataset.setTheme));
});

// ─── NAVIGATION STACK ───────────────────────────────────────────────
// We manage our own stack so the OS back button never exits the app.
// Strategy: always keep at least one "dummy" history entry ahead of us,
// so popstate is always triggered and we handle it ourselves.
const navStack = [];

const _pushDummyState = () => {
    history.pushState({ appInternal: true }, '');
};

const navigateTo = (viewId) => {
    const targetView = document.getElementById(viewId);
    if (!targetView) return;

    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    targetView.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(n => {
        n.classList.remove("active");
        if (n.dataset.target === viewId) n.classList.add("active");
    });

    if (viewId === 'view-students') renderStudents();
    if (viewId === 'view-reports') renderReports();

    // Track in our own stack
    navStack.push({ type: 'view', id: viewId });

    // Always keep a dummy state ahead so popstate fires on back
    _pushDummyState();
};

document.querySelectorAll(".nav-item, .back-btn").forEach(btn => {
    btn.addEventListener('click', (e) => {
        const viewId = e.currentTarget.dataset.target;
        navigateTo(viewId);
    });
});

// Swiping Action Engine Setup
const setupSwipe = (element, onSwipeLeft, onSwipeRight) => {
    let startX = 0, currentX = 0, isSwiping = false, opened = false;

    element.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        isSwiping = true;
        element.style.transition = 'none';
        element.style.cursor = 'grabbing';
    }, { passive: true });

    element.addEventListener('touchmove', e => {
        if (!isSwiping) return;
        currentX = e.touches[0].clientX;
        let diff = currentX - startX;

        // Disable swipe if no callback
        if (diff > 0 && !onSwipeRight) diff = 0;
        if (diff < 0 && !onSwipeLeft) diff = 0;

        // Limit pan
        if (diff > 100) diff = 100 + (diff - 100) * 0.2;
        if (diff < -100) diff = -100 + (diff + 100) * 0.2;

        element.style.transform = `translateX(${diff}px)`;
    }, { passive: true });

    const resetSwipe = () => {
        isSwiping = false;
        element.style.transition = 'transform 0.3s cubic-bezier(0.2,0,0,1)';
        element.style.transform = `translateX(0px)`;
    };

    element.addEventListener('touchend', e => {
        if (!isSwiping) return;
        let diff = currentX - startX;
        if (Math.abs(diff) > 50) {
            if (diff > 0 && onSwipeRight) {
                element.style.transform = `translateX(120%)`; // Slide out visually check
                setTimeout(() => onSwipeRight(), 200);
            }
            else if (diff < 0 && onSwipeLeft) {
                element.style.transform = `translateX(-120%)`;
                setTimeout(() => onSwipeLeft(), 200);
            } else {
                resetSwipe();
            }
        } else {
            resetSwipe();
        }
    });

    // Also support fallback buttons for desktop or clicks inside actions
};

// Avatar color palette — generates a consistent color per name
const AVATAR_COLORS = [
    '#6366f1','#8b5cf6','#ec4899','#f97316',
    '#10b981','#3b82f6','#ef4444','#f59e0b',
    '#14b8a6','#a855f7'
];
const getAvatarColor = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const getInitials = (name) => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Renders
const renderStudents = () => {
    const list = document.getElementById("student-list");
    let students = DB.getStudents();
    const query = document.getElementById("search-student").value.toLowerCase();
    const sort = document.getElementById("sort-students").value;
    const clsFilter = document.getElementById("filter-students-class").value;
    const actFilter = document.getElementById("filter-students-activity").value;

    if (query) {
        students = students.filter(s => s.name.toLowerCase().includes(query) || (s.class && s.class.toLowerCase().includes(query)));
    }
    if (clsFilter) {
        students = students.filter(s => s.class === clsFilter);
    }

    students.forEach(s => s._metrics = getStudentMetrics(s.id));

    if (actFilter === 'com') {
        students = students.filter(s => s._metrics.total > 0);
    } else if (actFilter === 'sem') {
        students = students.filter(s => s._metrics.total === 0);
    }

    if (sort === "name-asc") students.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name-desc") students.sort((a, b) => b.name.localeCompare(a.name));
    if (sort === "tasks-desc") students.sort((a, b) => b._metrics.completed - a._metrics.completed);

    list.innerHTML = "";

    if (students.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-graduate"></i>
                <p>Nenhum aluno encontrado.</p>
            </div>`;
        return;
    }

    // Count header
    const counter = document.createElement('div');
    counter.className = 'list-count-header';
    counter.textContent = `${students.length} aluno${students.length !== 1 ? 's' : ''}`;
    list.appendChild(counter);

    // Compact list wrapper
    const compactList = document.createElement('div');
    compactList.className = 'student-compact-list';

    students.forEach(s => {
        const hasActivity = s._metrics.total > 0;
        const color = hasActivity ? getAvatarColor(s.name) : '#ef4444';
        const initials = getInitials(s.name);
        const row = document.createElement('div');
        row.className = 'student-row';
        row.innerHTML = `
            <div class="student-avatar" style="background:${color};">${initials}</div>
            <div class="student-info">
                <div class="student-name">${s.name}</div>
                <div class="student-class-tag">${s.class || 'Sem turma'}</div>
            </div>
            <div class="visto-badge${!hasActivity ? ' no-activity' : ''}">
                <i class="fas fa-check-circle"></i>
                ${s._metrics.completed}
            </div>
            <button class="student-row-edit" onclick="editStudentAction(event, '${s.id}')" aria-label="Editar aluno">
                <i class="fas fa-pen"></i>
            </button>
            <i class="fas fa-chevron-right student-chevron"></i>
        `;
        row.addEventListener('click', (e) => {
            if (!e.target.closest('.student-row-edit')) {
                openStudentDetails(s.id);
            }
        });
        compactList.appendChild(row);
    });

    list.appendChild(compactList);

    // Also update Top 10 from here
    renderTop10();
};

const renderTop10 = () => {
    const list = document.getElementById("top10-list");
    const container = document.getElementById("top10-home");
    const searchVal = document.getElementById("search-student").value;
    const classFilter = document.getElementById("filter-students-class").value;
    
    // Only show Top 10 when not searching or filtering by class, to avoid clutter
    if (searchVal || classFilter) {
        container.style.display = "none";
        return;
    }

    const students = DB.getStudents();
    students.forEach(s => s._m = getStudentMetrics(s.id));
    
    // Sort by monthly completed tasks and take top 10
    const top = students
        .filter(s => s._m.completed > 0)
        .sort((a, b) => b._m.completed - a._m.completed)
        .slice(0, 10);

    if (top.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "block";
    list.innerHTML = "";
    
    top.forEach((s, idx) => {
        const row = document.createElement("div");
        row.className = "top10-row";
        const rankLabel = idx + 1;
        
        row.innerHTML = `
            <div class="top10-rank">${rankLabel}</div>
            <div class="top10-info">
                <div class="top10-name">
                    ${s.name}, turma ${s.class || 'N/A'} - <strong>${s._m.completed} vistos</strong>
                </div>
            </div>
        `;
        row.addEventListener('click', () => openStudentDetails(s.id));
        list.appendChild(row);
    });
};

document.getElementById("search-student").addEventListener('input', renderStudents);
document.getElementById("sort-students").addEventListener('change', renderStudents);
document.getElementById("filter-students-class").addEventListener('change', renderStudents);
document.getElementById("filter-students-activity").addEventListener('change', renderStudents);
document.getElementById("filter-report-class").addEventListener('change', renderReports);

const openStudentDetails = (id) => {
    currentStudentId = id;
    const st = DB.getStudents().find(s => s.id === id);
    if (!st) return;

    document.getElementById("detail-student-name").innerText = st.name;
    document.getElementById("detail-student-class").innerText = st.class || 'Nenhuma turma';

    renderTasks();
    navigateTo('view-student-details');
};

const renderTasks = () => {
    const list = document.getElementById("task-list");
    const m = getStudentMetrics(currentStudentId);

    document.getElementById("detail-stat-completed").innerText = m.completed;
    document.getElementById("detail-stat-avg").innerText = m.avg;

    let tasks = DB.getStudentTasks(currentStudentId);
    if (currentMonth) {
        tasks = tasks.filter(t => t.date.startsWith(currentMonth));
    }
    const sort = document.getElementById("sort-tasks").value;

    if (sort === "date-desc") tasks.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sort === "date-asc") tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sort === "status") tasks.sort((a, b) => a.status.localeCompare(b.status));

    list.innerHTML = "";
    if (tasks.length === 0) list.innerHTML = `<p class="text-secondary ms-2 pb-extended">Nenhuma tarefa. Clique em + para adicionar.</p>`;

    tasks.forEach(t => {
        const wrap = document.createElement('div');
        wrap.className = "swipe-container";

        let actionsHtml = `<div class="swipe-actions">
            <div class="action-left" onclick="deleteTaskAction('${t.id}')"><i class="fas fa-trash"></i></div>
            <div class="action-right" onclick="toggleTaskAction('${t.id}')"><i class="fas fa-check"></i></div>
        </div>`;

        let isDone = t.status === 'concluido';
        wrap.innerHTML = actionsHtml + `
            <div class="swipe-content" style="${isDone ? 'border-left: 4px solid var(--success);' : 'border-left: 4px solid var(--pending);'}" onclick="editTaskAction('${t.id}')">
                <div class="card-title">${t.name}</div>
                <div class="task-meta mt-2">
                    <span class="task-status ${t.status}">${isDone ? '✅ Visto' : '⏳ Pendente'}</span>
                    <span>Data do Visto: ${new Date(t.date).toLocaleDateString('pt-BR')}</span>
                    ${t.grade ? `<span class="task-grade">Nota: ${t.grade}</span>` : ''}
                </div>
            </div>
        `;
        list.appendChild(wrap);

        // Setup touch swipe
        // Setup touch swipe only if NOT done
        const content = wrap.querySelector('.swipe-content');
        if (!isDone) {
            setupSwipe(content,
                () => deleteTaskAction(t.id),
                () => toggleTaskAction(t.id)
            );
        }
    });
};
document.getElementById("sort-tasks").addEventListener('change', renderTasks);

window.editStudentAction = (e, id) => {
    if (e) e.stopPropagation();
    currentStudentId = id;
    const st = DB.getStudents().find(s => s.id === id);
    if (st) {
        document.getElementById("student-id").value = st.id;
        document.getElementById("student-name").value = st.name;
        document.getElementById("student-class").value = st.class;
        document.getElementById("modal-student-title").innerText = "Editar Aluno";
        openModal("modal-student");
    }
};

window.deleteStudentAction = (e, id) => {
    if (e) e.stopPropagation();
    // Action removed
};

window.deleteTaskAction = (id) => {
    DB.deleteTask(id);
    renderTasks();
    showToast("Tarefa excluída");
};
window.toggleTaskAction = (id) => {
    let t = DB.getTasks().find(x => x.id === id);
    if (t) {
        t.status = t.status === 'pendente' ? 'concluido' : 'pendente';
        DB.updateTask(t);
        renderTasks();
    }
};
window.editTaskAction = (id) => {
    let t = DB.getTasks().find(x => x.id === id);
    if (t) {
        document.getElementById("task-id").value = t.id;
        document.getElementById("task-name").value = t.name;
        document.getElementById("task-date").value = t.date;
        document.getElementById("task-grade").value = t.grade || '';

        document.getElementById("modal-task-title").innerText = "Editar Tarefa";
        document.getElementById("btn-delete-task-modal").style.display = "block";
        openModal("modal-task");
    }
};

const renderReports = () => {
    const students = DB.getStudents();
    let tasks = DB.getTasks();
    if (currentMonth) {
        tasks = tasks.filter(t => t.date.startsWith(currentMonth));
    }

    document.getElementById("report-total-alunos").innerText = students.length;
    document.getElementById("report-total-vistos").innerText = tasks.filter(t => t.status === 'concluido').length;

    let sum = 0, count = 0;
    tasks.forEach(t => {
        let v = calcGradeValue(t.grade);
        if (v !== null) { sum += v; count++; }
    });
    document.getElementById("report-geral-media").innerText = count ? sum.toFixed(1) : '-';

    students.forEach(s => s._m = getStudentMetrics(s.id));

    // Apply class filter for ranking
    const reportClassFilter = document.getElementById("filter-report-class").value;
    let rankStudents = students.slice();
    if (reportClassFilter) {
        rankStudents = rankStudents.filter(s => s.class === reportClassFilter);
    }

    let top = rankStudents.sort((a, b) => b._m.completed - a._m.completed).slice(0, 5);

    const list = document.getElementById("report-top-students");
    list.innerHTML = "";

    if (top.length === 0) {
        list.innerHTML = `<p class="text-secondary ms-2">Nenhum aluno encontrado nesta turma.</p>`;
        return;
    }

    top.forEach((s, idx) => {
        const medals = ['🥇','🥈','🥉'];
        const medal = idx < 3 ? medals[idx] : `#${idx+1}`;
        list.innerHTML += `
            <div class="card glass mb-2">
                <div class="card-top">
                    <div style="display:flex; flex-direction:column; gap:0.1rem;">
                        <div><b>${medal}</b> ${s.name}</div>
                        <span style="font-size:0.78rem; color:var(--text-secondary); padding-left:1.6rem;">${s.class || 'Sem turma'}</span>
                    </div>
                    <span class="badge bg-success text-success">${s._m.completed} Vistos</span>
                </div>
            </div>
        `;
    });
};

// --- MODALS ---
const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.add("active");
    document.getElementById("modal-overlay").classList.add("active");

    // Track modal in our stack
    navStack.push({ type: 'modal', id });
    _pushDummyState();
};

const closeModal = () => {
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
    document.getElementById("modal-overlay").classList.remove("active");

    // Remove modal entries from our stack
    while (navStack.length && navStack[navStack.length - 1].type === 'modal') {
        navStack.pop();
    }
};

// ─── BACK BUTTON HANDLER ────────────────────────────────────────────
// The OS fires popstate when the user presses back.
// We consume it and decide what to do based on our own navStack.
window.addEventListener('popstate', () => {
    // Check if a modal is open — close it first
    const activeModal = document.querySelector(".modal.active");
    if (activeModal) {
        closeModal();
        _pushDummyState(); // Re-add dummy so next back press is also caught
        return;
    }

    // Pop our own stack
    if (navStack.length > 0) navStack.pop();

    const prev = navStack.length > 0 ? navStack[navStack.length - 1] : null;

    if (prev && prev.type === 'view' && prev.id !== 'view-students') {
        // Go to previous view (e.g. student details → students list)
        const targetView = document.getElementById(prev.id);
        if (targetView) {
            document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
            targetView.classList.add("active");
            document.querySelectorAll(".nav-item").forEach(n => {
                n.classList.remove("active");
                if (n.dataset.target === prev.id) n.classList.add("active");
            });
            if (prev.id === 'view-students') renderStudents();
            if (prev.id === 'view-reports') renderReports();
        }
    } else {
        // Fallback: go to students list
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        document.getElementById('view-students').classList.add("active");
        document.querySelectorAll(".nav-item").forEach(n => {
            n.classList.remove("active");
            if (n.dataset.target === 'view-students') n.classList.add("active");
        });
        renderStudents();
        navStack.length = 0;
        navStack.push({ type: 'view', id: 'view-students' });
    }

    // Always push a new dummy so the next back press fires popstate too
    _pushDummyState();
});

document.querySelectorAll(".close-modal").forEach(b => b.addEventListener('click', () => closeModal()));
document.getElementById("modal-overlay").addEventListener('click', () => closeModal());

 




// "Novo Aluno" button removed from student list view
// Students can only be added via bulk registration in settings

document.getElementById("form-bulk").addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = document.getElementById("bulk-names").value;
    const turma = document.getElementById("bulk-class").value;
    const lines = txt.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let students = DB.getStudents();
    lines.forEach(name => {
        students.push({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
            name: name,
            class: turma,
            createdAt: new Date().toISOString()
        });
    });
    DB.saveStudents(students);

    // Also save the class if it's new
    if (turma) {
        let classes = DB.getClasses();
        if (!classes.includes(turma)) {
            classes.push(turma);
            classes.sort();
            DB.saveClasses(classes);
        }
    }

    closeModal();
    showToast(`${lines.length} alunos cadastrados em massa!`);
    renderStudents();
    renderClassesConfig();
    navigateTo('view-students');
});

document.getElementById("btn-edit-student").addEventListener('click', () => {
    const st = DB.getStudents().find(s => s.id === currentStudentId);
    if (st) {
        document.getElementById("student-id").value = st.id;
        document.getElementById("student-name").value = st.name;
        document.getElementById("student-class").value = st.class;
        document.getElementById("modal-student-title").innerText = "Editar Aluno";
        openModal("modal-student");
    }
});

document.getElementById("btn-add-task").addEventListener('click', () => {
    document.getElementById("form-task").reset();
    document.getElementById("task-id").value = "";
    document.getElementById("task-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("modal-task-title").innerText = "Nova Tarefa";
    document.getElementById("btn-delete-task-modal").style.display = "none";
    openModal("modal-task");
});

document.getElementById("btn-delete-task-modal").addEventListener('click', () => {
    const id = document.getElementById("task-id").value;
    if (id && confirm("Deseja realmente excluir esta tarefa/visto?")) {
        DB.deleteTask(id);
        renderTasks();
        closeModal();
        showToast("Tarefa excluída");
    }
});

document.getElementById("form-student").addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById("student-id").value;
    const obj = {
        id: id || Date.now().toString(),
        name: document.getElementById("student-name").value,
        class: document.getElementById("student-class").value,
        createdAt: new Date().toISOString()
    };
    if (id) DB.updateStudent(obj);
    else DB.addStudent(obj);

    closeModal();
    renderStudents();
    if (id && currentStudentId === id) openStudentDetails(id);
    showToast("Aluno salvo!");
});

document.getElementById("form-task").addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById("task-id").value;
    const obj = {
        id: id || Date.now().toString(),
        studentId: currentStudentId,
        name: document.getElementById("task-name").value,
        date: document.getElementById("task-date").value,
        status: 'concluido',
        grade: document.getElementById("task-grade").value,
        createdAt: new Date().toISOString()
    };
    if (id) DB.updateTask(obj);
    else DB.addTask(obj);

    closeModal();
    renderTasks();
    showToast("Tarefa salva!");
});


// --- EXPORT & SETTINGS ---
// Safety wrapper for listeners
const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
};

bindClick("btn-export-json", () => {
    const data = {
        alunos: DB.getStudents(),
        tarefas: DB.getTasks(),
        classes: DB.getClasses(),
        exportData: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = 'none';
    a.href = url;
    a.download = `backup_escola_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
});

const importInput = document.getElementById("import-json");
if (importInput) {
    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.alunos) {
                    DB.saveStudents(data.alunos);
                    if (data.tarefas) DB.saveTasks(data.tarefas);
                    if (data.classes) DB.saveClasses(data.classes);
                    showToast("Dados recuperados com sucesso!");
                    renderClassesConfig();
                    renderStudents();
                } else {
                    showToast("Formato de arquivo inválido", "error");
                }
            } catch (err) {
                showToast("Erro ao ler JSON", "error");
            }
        };
        reader.readAsText(file);
    });
}

bindClick("btn-clear-data", () => {
    if (confirm("ATENÇÃO: Isso apagará TODOS os seus alunos, turmas e vistos permanentemente do dispositivo. Confirma?")) {
        DB.clearAll();
        renderClassesConfig();
        renderStudents();
        showToast("Todos os dados foram apagados!");
        navigateTo('view-students');
    }
});

bindClick("btn-bulk-students", () => {
    document.getElementById("form-bulk").reset();
    openModal("modal-bulk");
});

bindClick("btn-manage-classes", () => {
    renderClassesConfig();
    openModal("modal-manage-classes");
});

// --- GERENCIAR TURMAS ---
const renderClassesConfig = () => {
    let classes = DB.getClasses();

    // Auto-migrate non-existent classes
    const students = DB.getStudents();
    let madeChanges = false;
    students.forEach(s => {
        if (s.class && !classes.includes(s.class)) {
            classes.push(s.class);
            madeChanges = true;
        }
    });
    if (madeChanges) {
        classes.sort();
        DB.saveClasses(classes);
    }

    const buildOpts = (def) => {
        let h = `<option value="">${def}</option>`;
        classes.forEach(c => h += `<option value="${c}">${c}</option>`);
        return h;
    };

    const fClass = document.getElementById("filter-students-class");
    if (fClass) { const v1 = fClass.value; fClass.innerHTML = buildOpts("Todas as Turmas"); fClass.value = v1; }

    const rClass = document.getElementById("filter-report-class");
    if (rClass) { const vr = rClass.value; rClass.innerHTML = buildOpts("Geral (Todas)"); rClass.value = vr; }

    const sClass = document.getElementById("student-class");
    if (sClass) { const v2 = sClass.value; sClass.innerHTML = buildOpts("Selecione a Turma"); sClass.value = v2; }

    const bClass = document.getElementById("bulk-class");
    // bulk-class is now an input, so we don't build options for it
    if (bClass && bClass.tagName === 'SELECT') { 
        const v3 = bClass.value; 
        bClass.innerHTML = buildOpts("Nenhuma / Sem Turma"); 
        bClass.value = v3; 
    }

    const list = document.getElementById("classes-list");
    if (list) {
        list.className = "list"; // reuse list spacing
        list.innerHTML = "";
        if (classes.length === 0) list.innerHTML = "<p class='text-secondary'>Nenhuma turma cadastrada.</p>";

        classes.forEach(c => {
            const classStudents = students.filter(s => s.class === c);
            const panel = document.createElement("div");
            panel.className = "class-panel";
            
            let studentsHtml = classStudents.length > 0 
                ? classStudents.map(s => `
                    <div class="class-student-item">
                        <i class="fas fa-user-graduate"></i>
                        <span>${s.name}</span>
                    </div>
                  `).join('')
                : "<p class='text-secondary' style='font-size:0.75rem; padding: 0.5rem;'>Nenhum aluno nesta turma.</p>";

            panel.innerHTML = `
                <div class="class-panel-header" onclick="this.nextElementSibling.style.display = (this.nextElementSibling.style.display === 'none' ? 'flex' : 'none')">
                    <div style="flex:1;">
                        <span class="class-panel-title">${c}</span>
                        <span class="class-student-count">(${classStudents.length} alunos)</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="icon-btn text-primary" onclick="event.stopPropagation(); window.addStudentsToClass('${c}')">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="icon-btn text-danger" onclick="event.stopPropagation(); deleteClassAction('${c}')">
                            <i class="fas fa-trash"></i>
                        </button>
                        <i class="fas fa-chevron-down text-secondary" style="font-size:0.8rem; align-self:center;"></i>
                    </div>
                </div>
                <div class="class-panel-students" style="display: none;">
                    ${studentsHtml}
                </div>
            `;
            list.appendChild(panel);
        });
    }
};

window.addStudentsToClass = (c) => {
    closeModal();
    setTimeout(() => {
        document.getElementById("form-bulk").reset();
        document.getElementById("bulk-class").value = c;
        openModal("modal-bulk");
    }, 400); // Wait for modal animation
};

window.deleteClassAction = (c) => {
    if (confirm(`Excluir a turma "${c}" do cadastro? Os alunos NÃO serão apagados, mas a turma sumirá das opções.`)) {
        let classes = DB.getClasses().filter(x => x !== c);
        DB.saveClasses(classes);
        renderClassesConfig();
        renderStudents();
    }
};

 


const formManageAddClass = document.getElementById("form-manage-add-class");
if (formManageAddClass) {
    formManageAddClass.addEventListener('submit', (e) => {
        e.preventDefault();
        const className = document.getElementById("new-class-name-manage").value.trim();
        const studentNamesRaw = document.getElementById("new-class-students-manage").value;
        const studentNames = studentNamesRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        if (className) {
            let classes = DB.getClasses();
            if (!classes.includes(className)) {
                classes.push(className);
                classes.sort();
                DB.saveClasses(classes);
            }

            if (studentNames.length > 0) {
                let students = DB.getStudents();
                studentNames.forEach(name => {
                    students.push({
                        id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
                        name: name,
                        class: className,
                        createdAt: new Date().toISOString()
                    });
                });
                DB.saveStudents(students);
            }

            document.getElementById("new-class-name-manage").value = "";
            document.getElementById("new-class-students-manage").value = "";
            renderClassesConfig();
            renderStudents();
            showToast(`Turma ${className} e ${studentNames.length} alunos cadastrados!`);
        }
    });
}

// ─── BOOT ───────────────────────────────────────────────────────────
initTheme();
renderClassesConfig();
renderStudents();

// Seed navigation stack with the initial view
navStack.push({ type: 'view', id: 'view-students' });

// Replace the current history entry with a base state,
// then push a dummy so the FIRST back press is caught by popstate
history.replaceState({ appBase: true }, '');
_pushDummyState();

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}
