const generateBtn = document.getElementById('generateBtn');
const testGenerateBtn = document.getElementById('testGenerateBtn');
const resetBtn = document.getElementById('resetBtn');
const reportDate = document.getElementById('zReportDate');
const reportOutput = document.getElementById('zReportOutput');

// Set default date to today
reportDate.valueAsDate = new Date();

// ---------- Create Chart.js instance ----------
const zctx = document.getElementById('zReportChart').getContext('2d');
let zChart = new Chart(zctx, {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Z-Report Totals',
            data: [],
            backgroundColor: 'rgba(166, 15, 45, 0.7)',
            borderColor: 'rgba(166, 15, 45, 1)',
            borderWidth: 1
        }]
    },
    options: { 
        responsive: true, 
        maintainAspectRatio: false
    }
});

// ---------- Event Listeners ----------
generateBtn.addEventListener('click', () => loadZReport(false));
testGenerateBtn.addEventListener('click', () => loadZReport(true));
resetBtn.addEventListener('click', resetZReport);

// ---------- Load Z-Report ----------
async function loadZReport(testMode) {
    const date = reportDate.value;
    if (!date) {
        alert("Please select a report date.");
        return;
    }

    try {
        const res = await fetch(`/api/zreport?date=${date}&test=${testMode}`);
        const data = await res.json();
        console.log("REPORT FROM SERVER:\n", data.report);


        // Save raw text (hidden)
        reportOutput.value = data.report;

        // Convert text -> dataset
        const totals = extractTotalsFromText(data.report);

        // Update chart
        zChart.data.labels = totals.labels;
        zChart.data.datasets[0].data = totals.values;
        zChart.update();

        if (data.message) alert(data.message);

    } catch (err) {
        console.error(err);
        alert("Error generating Z-Report.");
    }
}

// ---------- Convert report text into chart-friendly values ----------
function extractTotalsFromText(text) {
    const labels = [];
    const values = [];

    // Fix: trim whitespace, handle Windows/Mac/Linux newlines
    const lines = text.split(/\r?\n/).map(l => l.trim());

    const mapping = [
        ["Total Orders:", "orders"],
        ["Total Sales:", "sales"],
        ["Tax (10%):", "tax"],
        ["Total Cash:", "cash"]
    ];

    mapping.forEach(([label]) => {
        const line = lines.find(l => l.startsWith(label));
        if (line) {
            const num = Number(line.replace(/[^0-9.]/g, ""));
            labels.push(label.replace(":", "")); // remove colon for display
            values.push(num);
        }
    });

    return { labels, values };
}

// ---------- Reset Z-Report ----------
async function resetZReport() {
    if (!confirm("Reset daily totals? This does NOT delete orders.")) return;

    try {
        const res = await fetch('/api/zreport/reset', { method: 'POST' });
        const data = await res.json();

        alert(data.message);

        // Clear hidden text + chart
        reportOutput.value = '';
        zChart.data.labels = [];
        zChart.data.datasets[0].data = [];
        zChart.update();

    } catch (err) {
        console.error(err);
        alert("Error resetting Z-Report.");
    }
}
