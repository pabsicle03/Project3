const tblEmployees = document.getElementById("tblEmployees").querySelector("tbody");
const refreshBtn = document.getElementById("refreshBtn");
const addBtn = document.getElementById("addBtn");
const removeBtn = document.getElementById("removeBtn");

// Modal elements
const modal = document.getElementById("employeeModal");
const empIdInput = document.getElementById("empId");
const empNameInput = document.getElementById("empName");
const cancelModalBtn = document.getElementById("cancelModal");
const saveModalBtn = document.getElementById("saveModal");

// --- Load employees ---
async function loadEmployees() {
    try {
        const res = await fetch("/api/manager/employees");
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed to fetch employees");

        tblEmployees.innerHTML = "";
        data.employees.forEach(emp => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${emp.employee_id}</td>
                <td>${emp.employee_name}</td>
            `;
            tr.addEventListener("click", () => tr.classList.toggle("selected"));
            tblEmployees.appendChild(tr);
        });
    } catch (err) {
        alert("Error loading employees: " + err.message);
        console.error(err);
    }
}

// --- Show modal ---
function openModal(id = "", name = "") {
    empIdInput.value = id;
    empNameInput.value = name;
    modal.style.display = "flex";
    empIdInput.focus();
}

// --- Hide modal ---
function closeModal() {
    modal.style.display = "none";
}

// --- Save employee ---
async function saveEmployee() {
    const id = empIdInput.value.trim();
    const name = empNameInput.value.trim();
    if (!id || !name) {
        alert("Both fields are required");
        return;
    }

    try {
        const res = await fetch("/api/manager/employees", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ employee_id: Number(id), employee_name: name })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Save failed");

        closeModal();
        loadEmployees();
    } catch (err) {
        alert(err.message);
        console.error(err);
    }
}

// --- Remove selected employees ---
async function removeEmployee() {
    const selected = Array.from(tblEmployees.querySelectorAll("tr.selected"));
    if (selected.length === 0) {
        alert("Select at least one employee to remove");
        return;
    }
    if (!confirm(`Delete ${selected.length} employee(s)?`)) return;

    try {
        for (const tr of selected) {
            const empId = Number(tr.children[0].textContent);
            const res = await fetch("/api/manager/employees/" + empId, { method: "DELETE" });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Delete failed");
        }
        loadEmployees();
    } catch (err) {
        alert(err.message);
        console.error(err);
    }
}

// --- Button listeners ---
refreshBtn.addEventListener("click", loadEmployees);
addBtn.addEventListener("click", () => openModal());
removeBtn.addEventListener("click", removeEmployee);
cancelModalBtn.addEventListener("click", closeModal);
saveModalBtn.addEventListener("click", saveEmployee);

// --- Initial load ---
loadEmployees();
