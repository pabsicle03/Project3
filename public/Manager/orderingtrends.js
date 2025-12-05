let pieChart, lineChart;

async function loadOrderingTrends() {
    try {
        const res = await fetch("/api/manager/orderingtrends");
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Failed to fetch ordering trends");

        // ---- Text fields ----
        document.getElementById("mostOrdered").textContent =
            `${data.mostOrdered.drink_name} (${data.mostOrdered.count})`;

        document.getElementById("leastOrdered").textContent =
            `${data.leastOrdered.drink_name} (${data.leastOrdered.count})`;

        const totalRevenue = data.revenue.reduce(
            (sum, r) => sum + Number(r.revenue), 0
        );
        document.getElementById("totalRevenue").textContent = totalRevenue.toFixed(2);

        // ---- Build charts ----
        buildPieChart(data.revenue);
        buildLineChart(data.revenue);

    } catch (err) {
        console.error("Ordering Trends Error:", err);
    }
}


// ================= PIE CHART =================
function buildPieChart(revenueRows) {
    const labels = revenueRows.map(r => r.drink_name);
    const values = revenueRows.map(r => Number(r.revenue));

    const ctx = document.getElementById("pieChart");

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data: values,
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: "left",     // 🔥 moved from bottom
                    align: "center",
                    labels: {
                        boxWidth: 20,
                        padding: 12,
                        font: { size: 12 }
                    }
                },
                title: { display: true, text: "Revenue by Drink" }
            }
        }
    });
}


// ================= LINE CHART =================
// Uses revenue as a "trend". If you later send timestamps, I can update it.
function buildLineChart(revenueRows) {
    const labels = revenueRows.map(r => r.drink_name);
    const values = revenueRows.map(r => Number(r.revenue));

    const ctx = document.getElementById("lineChart");

    if (lineChart) lineChart.destroy();

    lineChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Revenue Trend",
                data: values,
                tension: 0.3
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { display: true, text: "Revenue Trend" }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    
}


document.getElementById("refreshTrendsBtn").addEventListener("click", loadOrderingTrends);


document.addEventListener("DOMContentLoaded", loadOrderingTrends);