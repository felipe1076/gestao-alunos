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
    document.documentElement.setAttribute("data-theme", theme);
    document.getElementById("theme-toggle").innerHTML = theme === "dark"
        ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
};
document.getElementById("theme-toggle").addEventListener('click', () => {
    let theme = document.documentElement.getAttribute("data-theme");
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("escola_theme", theme);
    document.getElementById("theme-toggle").innerHTML = theme === "dark"
        ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

// Navigation
const navigateTo = (viewId) => {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(viewId).classList.add("active");

    document.querySelectorAll(".nav-item").forEach(n => {
        n.classList.remove("active");
        if (n.dataset.target === viewId) n.classList.add("active");
    });

    if (viewId === 'view-students') renderStudents();
    if (viewId === 'view-reports') renderReports();
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

// Renders
const renderStudents = () => {
    const list = document.getElementById("student-list");
    let students = DB.getStudents();
    const query = document.getElementById("search-student").value.toLowerCase();
    const sort = document.getElementById("sort-students").value;
    const clsFilter = document.getElementById("filter-students-class").value;

    if (query) {
        students = students.filter(s => s.name.toLowerCase().includes(query) || (s.class && s.class.toLowerCase().includes(query)));
    }
    if (clsFilter) {
        students = students.filter(s => s.class === clsFilter);
    }

    students.forEach(s => s._metrics = getStudentMetrics(s.id));

    if (sort === "name-asc") students.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name-desc") students.sort((a, b) => b.name.localeCompare(a.name));
    if (sort === "tasks-desc") students.sort((a, b) => b._metrics.completed - a._metrics.completed);

    list.innerHTML = "";
    if (students.length === 0) list.innerHTML = `<p class="text-secondary ms-2">Nenhum aluno encontrado.</p>`;

    students.forEach(s => {
        const el = document.createElement('div');
        el.className = "card glass";
        el.innerHTML = `
            <div onclick="openStudentDetails('${s.id}')" style="flex: 1; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div class="card-top">
                        <div class="card-title">${s.name}</div>
                    </div>
                    <div class="subtitle mt-2">${s.class || 'Sem Turma'} &bull; Soma: ${s._metrics.avg}</div>
                </div>
                <div>
                    <button class="btn-primary ripple" style="border-radius: 20px; padding: 0.5rem 1rem; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;" onclick="openStudentDetails('${s.id}')">
                        <i class="fas fa-check-circle"></i> ${s._metrics.completed}
                    </button>
                </div>
            </div>
            <div style="display: flex; gap: 1rem; border-top: 1px solid var(--glass-border); padding-top: 0.75rem; margin-top: 0.5rem; justify-content: flex-end;">
                <button class="icon-btn" onclick="editStudentAction(event, '${s.id}')" style="width: auto; height: auto; font-size: 1rem; color: var(--text-primary);"><i class="fas fa-edit"></i> Editar</button>
                <button class="icon-btn" onclick="deleteStudentAction(event, '${s.id}')" style="width: auto; height: auto; font-size: 1rem; color: var(--danger);"><i class="fas fa-trash"></i> Excluir</button>
            </div>
        `;
        list.appendChild(el);
    });
};

document.getElementById("search-student").addEventListener('input', renderStudents);
document.getElementById("sort-students").addEventListener('change', renderStudents);
document.getElementById("filter-students-class").addEventListener('change', renderStudents);

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
    if (confirm("Tem certeza que deseja apagar este aluno e TODAS as suas tarefas permanentemente?")) {
        DB.deleteStudent(id);
        if (currentStudentId === id) {
            navigateTo('view-students');
        } else {
            renderStudents();
        }
        showToast("Aluno excluído com sucesso!");
    }
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
    let top = students.sort((a, b) => b._m.completed - a._m.completed).slice(0, 5);

    const list = document.getElementById("report-top-students");
    list.innerHTML = "";
    top.forEach((s, idx) => {
        list.innerHTML += `
            <div class="card glass mb-2">
                <div class="card-top">
                    <div><b>#${idx + 1}</b> ${s.name}</div>
                    <span class="badge bg-success text-success">${s._m.completed} Vistos</span>
                </div>
            </div>
        `;
    });
};

// --- MODALS ---
const openModal = (id) => {
    document.getElementById(id).classList.add("active");
    document.getElementById("modal-overlay").classList.add("active");
};
const closeModal = () => {
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
    document.getElementById("modal-overlay").classList.remove("active");
};
document.querySelectorAll(".close-modal").forEach(b => b.addEventListener('click', closeModal));
document.getElementById("modal-overlay").addEventListener('click', closeModal);

document.getElementById("btn-bulk-students").addEventListener('click', () => {
    document.getElementById("form-bulk").reset();
    openModal("modal-bulk");
});



document.getElementById("btn-add-student").addEventListener('click', () => {
    document.getElementById("form-student").reset();
    document.getElementById("student-id").value = "";
    document.getElementById("modal-student-title").innerText = "Novo Aluno";
    openModal("modal-student");
});

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
    closeModal();
    showToast(`${lines.length} alunos cadastrados em massa!`);
    renderStudents();
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

document.getElementById("btn-delete-student").addEventListener('click', () => {
    if (confirm("Tem certeza que deseja apagar este aluno e todas as suas tarefas?")) {
        DB.deleteStudent(currentStudentId);
        showToast("Aluno excluído");
        navigateTo('view-students');
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
document.getElementById("btn-export-json").addEventListener('click', () => {
    const data = {
        alunos: DB.getStudents(),
        tarefas: DB.getTasks(),
        exportData: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_escola_${Date.now()}.json`;
    a.click();
});

document.getElementById("btn-export-csv").addEventListener('click', () => {
    const students = DB.getStudents();
    students.forEach(s => s._m = getStudentMetrics(s.id));

    let csv = "ID,Nome,Turma,Vistos,Soma Notas\n";
    students.forEach(s => {
        csv += `"${s.id}","${s.name}","${s.class || ''}",${s._m.completed},${s._m.avg}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_alunos_${Date.now()}.csv`;
    a.click();
});

document.getElementById("import-json").addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.alunos && data.tarefas) {
                DB.saveStudents(data.alunos);
                DB.saveTasks(data.tarefas);
                showToast("Dados recuperados com sucesso!");
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

document.getElementById("btn-clear-data").addEventListener('click', () => {
    if (confirm("ATENÇÃO: Isso apagará TODOS os seus alunos e vistos permanentemente do dispositivo. Confirma?")) {
        DB.clearAll();
        renderStudents();
        showToast("Dados apagados!");
        navigateTo('view-students');
    }
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

    const sClass = document.getElementById("student-class");
    if (sClass) { const v2 = sClass.value; sClass.innerHTML = buildOpts("Selecione a Turma"); sClass.value = v2; }

    const bClass = document.getElementById("bulk-class");
    if (bClass) { const v3 = bClass.value; bClass.innerHTML = buildOpts("Nenhuma / Sem Turma"); bClass.value = v3; }

    const list = document.getElementById("classes-list");
    if (list) {
        list.innerHTML = "";
        if (classes.length === 0) list.innerHTML = "<p class='text-secondary'>Nenhuma turma cadastrada.</p>";

        classes.forEach(c => {
            const d = document.createElement("div");
            d.className = "setting-item glass";
            d.innerHTML = `
                <div style="flex:1;"><b>${c}</b></div>
                <button class="icon-btn text-danger" onclick="deleteClassAction('${c}')"><i class="fas fa-trash"></i></button>
            `;
            list.appendChild(d);
        });
    }
};

window.deleteClassAction = (c) => {
    if (confirm(`Excluir a turma "${c}" do cadastro? Os alunos NÃO serão apagados, mas a turma sumirá das opções.`)) {
        let classes = DB.getClasses().filter(x => x !== c);
        DB.saveClasses(classes);
        renderClassesConfig();
        renderStudents();
    }
};

const btnManageClasses = document.getElementById("btn-manage-classes");
if (btnManageClasses) {
    btnManageClasses.addEventListener('click', () => {
        renderClassesConfig();
        openModal("modal-manage-classes");
    });
}

const formAddClass = document.getElementById("form-add-class");
if (formAddClass) {
    formAddClass.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = document.getElementById("new-class-name").value.trim();
        if (val) {
            let classes = DB.getClasses();
            if (!classes.includes(val)) {
                classes.push(val);
                classes.sort();
                DB.saveClasses(classes);
                document.getElementById("new-class-name").value = "";
                renderClassesConfig();
            } else {
                showToast("Turma já cadastrada", "error");
            }
        }
    });
}

// Boot
initTheme();
renderClassesConfig();
renderStudents();
