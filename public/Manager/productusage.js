const ctx = document.getElementById('productUsageChart').getContext('2d');

let productUsageChart = new Chart(ctx, {
    type: 'bar',
    data: { 
        labels: [], 
        datasets: [{
            label: 'Ingredient Usage Frequency',
            data: [],
            backgroundColor: 'rgba(166, 15, 45, 0.7)',
            borderColor: 'rgba(166, 15, 45, 1)',
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: 'Ingredient Usage Over Selected Period' }
        },
        scales: { y: { beginAtZero: true } }
    }
});

document.getElementById('loadBtn').addEventListener('click', loadProductUsage);

async function loadProductUsage() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;

    if (!start || !end) {
        return alert('Please select both start and end dates.');
    }

    try {
        const res = await fetch(`/api/productusage?start=${start}&end=${end}`);
        const rows = await res.json();

        // backend returns ingredient + times_used
        const labels = rows.map(r => r.ingredient);
        const values = rows.map(r => Number(r.times_used));

        productUsageChart.data.labels = labels;
        productUsageChart.data.datasets[0].data = values;
        productUsageChart.update();

    } catch (err) {
        console.error(err);
        alert('Failed to load ingredient usage data.');
    }
}
