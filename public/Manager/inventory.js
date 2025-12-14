// inventory.js

document.addEventListener("DOMContentLoaded", () => {
  const tables = {
    supplies: document.getElementById("tblSupplies"),
    ingredients: document.getElementById("tblIngredients"),
    menuitems: document.getElementById("tblMenuItems"),
    toppings: document.getElementById("tblToppings"),
  };

  // -------------------- helpers --------------------
  function getTbody(type) {
    const table = tables[type];
    if (!table) return null;
    return table.querySelector("tbody") || table;
  }

  // -------------------- load + render --------------------
  async function loadTable(type) {
    try {
      const res = await fetch(`/api/manager/inventory/${type}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");

      const tbody = getTbody(type);
      if (!tbody) return;

      tbody.innerHTML = "";

      data.items.forEach((item) => {
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

  // -------------------- add item (prompt-based) --------------------
  async function addItem(type) {
    // menuitems is handled by modal
    if (type === "menuitems") {
      openAddDrinkModal();
      return;
    }

    let keys = ["name"];
    if (type === "supplies" || type === "ingredients") keys.push("quantity");
    else keys.push("price");

    const values = keys.map((k) => prompt(`Enter ${k}:`, ""));
    if (values.includes(null) || values.includes("")) return;

    const body = {};
    keys.forEach((k, i) => (body[k] = values[i]));

    try {
      const res = await fetch(`/api/manager/inventory/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");
      loadTable(type);
    } catch (err) {
      console.error(err);
      alert("Failed to add item: " + err.message);
    }
  }

  // -------------------- update item --------------------
  async function openUpdateDialog(type, item) {
    const keys =
      type === "supplies" || type === "ingredients" ? ["quantity"] : ["price"];

    const values = keys.map((k) => prompt(`Update ${k}:`, item[k]));
    if (values.includes(null)) return;

    const body = {};
    keys.forEach((k, i) => (body[k] = values[i]));

    try {
      const res = await fetch(`/api/manager/inventory/${type}/${item.name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");
      loadTable(type);
    } catch (err) {
      console.error(err);
      alert("Failed to update item: " + err.message);
    }
  }

  // -------------------- delete item --------------------
  async function deleteItem(type, item) {
    if (!confirm(`Delete ${item.name}?`)) return;

    try {
      const res = await fetch(`/api/manager/inventory/${type}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Server error");
      loadTable(type);
    } catch (err) {
      console.error(err);
      alert("Failed to delete item: " + err.message);
    }
  }

  // ==================== MODAL: add menu item + recipe ====================
  const modal = document.getElementById("addDrinkModal");
  const closeModalBtn = document.getElementById("closeAddDrinkModal");
  const cancelBtn = document.getElementById("cancelNewDrinkBtn");
  const form = document.getElementById("addDrinkForm");
  const ingredientsList = document.getElementById("ingredientsList");

  function showModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function hideModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    if (form) form.reset();
    if (ingredientsList) ingredientsList.innerHTML = "";
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", hideModal);
  if (cancelBtn) cancelBtn.addEventListener("click", hideModal);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal();
    });
  }

  async function openAddDrinkModal() {
    if (!modal || !ingredientsList || !form) {
      alert(
        "Modal elements not found. Make sure inventory.html has the modal markup."
      );
      return;
    }

    try {
      const res = await fetch("/api/manager/inventory/ingredients");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load ingredients");

      // render ingredient checkboxes
      ingredientsList.innerHTML = data.items
        .map(
          (i) => `
        <label class="check" style="font-weight:600;">
          <input type="checkbox" value="${i.name}" />
          ${i.name}
        </label>
      `
        )
        .join("");

      showModal();
    } catch (err) {
      console.error(err);
      alert("Failed to open Add Menu Item: " + err.message);
    }
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("newDrinkName")?.value?.trim() || "";
      const priceRaw = document.getElementById("newDrinkPrice")?.value;
      const price = Number(priceRaw);

      const teaOptions = !!document.getElementById("newDrinkTeaOptions")?.checked;
      const hotOption = !!document.getElementById("newDrinkHotOption")?.checked;

      // Optional image filename (default.png if blank)
      const imageFile =
        document.getElementById("newDrinkImage")?.value?.trim() || "";

      const selectedIngredients = Array.from(
        ingredientsList.querySelectorAll("input[type='checkbox']:checked")
      ).map((cb) => cb.value);

      if (!name) {
        alert("Please enter a name.");
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        alert("Please enter a valid price.");
        return;
      }
      if (selectedIngredients.length === 0) {
        alert("Select at least 1 ingredient for the recipe.");
        return;
      }

      try {
        const resp = await fetch("/api/manager/menuitems/with-recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            price,
            teaOptions,
            hotOption,
            imageFile, // backend will default to default.png if blank
            ingredients: selectedIngredients,
          }),
        });

        const out = await resp.json();
        if (!out.ok) throw new Error(out.error || "Server error");

        hideModal();
        loadTable("menuitems");
      } catch (err) {
        console.error(err);
        alert("Failed to add menu item: " + err.message);
      }
    });
  }

  // -------------------- Setup Add buttons --------------------
  ["supplies", "ingredients", "toppings"].forEach((type) => {
    const btn = document.getElementById(`add-${type}`);
    if (btn) btn.addEventListener("click", () => addItem(type));
    loadTable(type);
  });

  // Menu items uses the modal (no prompts)
  const addMenuBtn = document.getElementById("add-menuitems");
  if (addMenuBtn) addMenuBtn.addEventListener("click", openAddDrinkModal);
  loadTable("menuitems");

  // -------------------- Refresh All --------------------
  const refreshBtn = document.getElementById("refreshAllBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      ["supplies", "ingredients", "menuitems", "toppings"].forEach((type) =>
        loadTable(type)
      );
    });
  }
});
