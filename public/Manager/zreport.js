const generateBtn = document.getElementById('generateBtn');
const testGenerateBtn = document.getElementById('testGenerateBtn');
const resetBtn = document.getElementById('resetBtn');
const reportDate = document.getElementById('zReportDate');
const reportOutput = document.getElementById('zReportOutput');

// Set default date to today
reportDate.valueAsDate = new Date();

generateBtn.addEventListener('click', () => loadZReport(false));
testGenerateBtn.addEventListener('click', () => loadZReport(true));
resetBtn.addEventListener('click', resetZReport);

async function loadZReport(testMode) {
    const date = reportDate.value;
    if (!date) {
        alert("Please select a report date.");
        return;
    }

    try {
        const res = await fetch(`/api/zreport?date=${date}&test=${testMode}`);
        const data = await res.json();
        reportOutput.value = data.report;
        if (data.message) alert(data.message);
    } catch (err) {
        console.error(err);
        alert("Error generating Z-Report.");
    }
}

async function resetZReport() {
    if (!confirm("Reset daily totals? This does NOT delete orders.")) return;

    try {
        const res = await fetch('/api/zreport/reset', { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        reportOutput.value = '';
    } catch (err) {
        console.error(err);
        alert("Error resetting Z-Report.");
    }
}
