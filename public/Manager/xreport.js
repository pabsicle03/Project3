const ctx = document.getElementById('xReportChart').getContext('2d');

let xReportChart = new Chart(ctx, {
    type: 'bar',
    data: { 
        labels: [], 
        datasets: [{
            label: 'Value',
            data: [],
            backgroundColor: 'rgba(166,15,45,0.7)',
            borderColor: 'rgba(166,15,45,1)',
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: 'X-Report for Selected Date' }
        },
        scales: { y: { beginAtZero: true } }
    }
});

// FIXED: correct button ID
document.getElementById('loadXBtn').addEventListener('click', loadXReport);

async function loadXReport() {
    const date = document.getElementById('reportDate').value;
    const metric = document.getElementById('metricSelect').value;

    if (!date) return alert('Please select a date.');

    // FIXED: Map dropdown text -> server metric keys
    const metricMap = {
        "Total Sales per Hour": "totalSales",
        "Number of Orders per Hour": "numOrders",
        "Sales by Employee/Manager per Hour": "salesByEmployee"
    };

    const metricKey = metricMap[metric];

    try {
        const res = await fetch(`/api/xreport?date=${date}&metric=${metricKey}`);
        const data = await res.json();

        xReportChart.data.labels = data.labels;
        xReportChart.data.datasets[0].data = data.values;
        xReportChart.update();

    } catch (err) {
        console.error(err);
        alert('Failed to load X-Report.');
    }
}
