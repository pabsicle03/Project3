const ctx = document.getElementById('productUsageChart').getContext('2d');
let productUsageChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Quantity Ordered', data: [], backgroundColor: 'rgba(166,15,45,0.7)', borderColor: 'rgba(166,15,45,1)', borderWidth: 1 }] },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: 'Drink Usage Over Selected Period' }
        },
        scales: { y: { beginAtZero: true } }
    }
});

document.getElementById('loadBtn').addEventListener('click', loadProductUsage);

async function loadProductUsage() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;

    if (!start || !end) return alert('Please select both start and end dates.');

    try {
        const res = await fetch(`/api/productusage?start=${start}&end=${end}`);
        const data = await res.json();

        productUsageChart.data.labels = data.labels;
        productUsageChart.data.datasets[0].data = data.values;
        productUsageChart.update();
    } catch (err) {
        console.error(err);
        alert('Failed to load product usage data.');
    }
}