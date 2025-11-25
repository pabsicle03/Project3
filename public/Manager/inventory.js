// inventory.js

document.addEventListener("DOMContentLoaded", () => {
  const tables = {
    supplies: document.getElementById("tblSupplies"),
    ingredients: document.getElementById("tblIngredients"),
    menuitems: document.getElementById("tblMenuItems"),
    toppings: document.getElementById("tblToppings")
  };

  // --- Fetch and populate a table ---
  async function loadTable(type) {
    try {
      const res = await fetch(`/api/manager/inventory/${type}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const table = tables[type];
      const tbody = table.querySelector("tbody");
      tbody.innerHTML = "";

      data.items.forEach(item => {
        const tr = document.createElement("tr");

        // For supplies/ingredients: name + quantity
        // For menuitems/toppings: name + price
        if (type === "supplies" || type === "ingredients") {
          tr.innerHTML = `<td>${item.name}</td><td>${item.quantity}</td>`;
        } else {
          tr.innerHTML = `<td>${item.name}</td><td>${item.price}</td>`;
        }

        // Action buttons
        const actionTd = document.createElement("td");
        const updateBtn = document.createElement("button");
        updateBtn.textContent = "Update";
        updateBtn.classList.add("update-btn");
        updateBtn.addEventListener("click", () => openUpdateDialog(type, item));
        actionTd.appendChild(updateBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.classList.add("delete-btn");
        deleteBtn.addEventListener("click", () => deleteItem(type, item));
        actionTd.appendChild(deleteBtn);

        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      alert("Failed to load table: " + err.message);
    }
  }

  // --- Add item ---
  async function addItem(type) {
    let keys = ["name"];
    if (type === "supplies" || type === "ingredients") keys.push("quantity");
    else keys.push("price");

    const values = keys.map(k => prompt(`Enter ${k}:`, ""));
    if (values.includes(null) || values.includes("")) return;

    const body = {};
    keys.forEach((k, i) => body[k] = values[i]);

    try {
      const res = await fetch(`/api/manager/inventory/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");
      loadTable(type);
    } catch (err) {
      console.error(err);
      alert("Failed to add item: " + err.message);
    }
  }

  // --- Update item ---
  async function openUpdateDialog(type, item) {
    let keys = type === "supplies" || type === "ingredients" ? ["quantity"] : ["price"];
    const values = keys.map(k => prompt(`Update ${k}:`, item[k]));
    if (values.includes(null)) return;

    const body = {};
    keys.forEach((k, i) => body[k] = values[i]);

    try {
      const res = await fetch(`/api/manager/inventory/${type}/${item.name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");
      loadTable(type);
    } catch (err) {
      console.error(err);
      alert("Failed to update item: " + err.message);
    }
  }

  // --- Delete item ---
  async function deleteItem(type, item) {
    if (!confirm(`Delete ${item.name}?`)) return;
    try {
      const res = await fetch(`/api/manager/inventory/${type}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");
      loadTable(type);
    } catch (err) {
      console.error(err);
      alert("Failed to delete item: " + err.message);
    }
  }

  // --- Setup Add buttons if you add them in HTML ---
  ["supplies", "ingredients", "menuitems", "toppings"].forEach(type => {
    const btn = document.getElementById(`add-${type}`);
    if (btn) btn.addEventListener("click", () => addItem(type));
    loadTable(type);
  });

  // --- Refresh All ---
  const refreshBtn = document.getElementById("refreshAllBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      ["supplies", "ingredients", "menuitems", "toppings"].forEach(type => loadTable(type));
    });
  }
});