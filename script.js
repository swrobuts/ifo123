// Firebase initialisieren
const firebaseConfig = {
  apiKey: "AIzaSyAR1rwh8aHpSNfqqqLY0nSCrQ_Futoobxw",
  authDomain: "datev-mi.firebaseapp.com",
  projectId: "datev-mi",
  storageBucket: "datev-mi.firebasestorage.app",
  messagingSenderId: "583133028759",
  appId: "1:583133028759:web:5b5ecbb1eb03235bdda4d2"
};

// Firebase Version 9 Modular API verwenden
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, query, orderBy, limit, where, Timestamp 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// App initialisieren
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM-Elemente
const metricSelect = document.getElementById('metric-select');
const timeframeSelect = document.getElementById('timeframe-select');
const mainChart = document.getElementById('main-chart');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const averageChangeElement = document.getElementById('average-change').querySelector('.stat-value');
const maxChangeElement = document.getElementById('max-change').querySelector('.stat-value');
const minChangeElement = document.getElementById('min-change').querySelector('.stat-value');
const currentTrendElement = document.getElementById('current-trend').querySelector('.stat-value');

// Chart-Instanz
let chart;

// Daten laden und anzeigen
async function loadData() {
  showLoading(true);
  
  try {
    const selectedMetric = metricSelect.value;
    const selectedTimeframe = timeframeSelect.value;
    
    // Abfrage erstellen
    let dataQuery = query(
      collection(db, selectedMetric),
      orderBy('timestamp', 'asc')
    );
    
    // Zeitraum-Filter anwenden, wenn nicht "all" ausgewählt
    if (selectedTimeframe !== 'all') {
      const yearsAgo = parseInt(selectedTimeframe);
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsAgo);
      
      dataQuery = query(
        collection(db, selectedMetric),
        where('timestamp', '>=', Timestamp.fromDate(cutoffDate)),
        orderBy('timestamp', 'asc')
      );
    }
    
    // Daten abrufen
    const querySnapshot = await getDocs(dataQuery);
    
    // Daten transformieren
    const chartData = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.wert !== null) {  // Null-Werte überspringen
        chartData.push({
          date: `${data.jahr}-${String(data.monat).padStart(2, '0')}`,
          value: data.wert
        });
      }
    });
    
    // Chart aktualisieren
    updateChart(chartData);
    
    // Statistiken berechnen und anzeigen
    updateStatistics(chartData);
    
    showLoading(false);
  } catch (error) {
    console.error("Fehler beim Laden der Daten:", error);
    showError(true);
    showLoading(false);
  }
}

// Chart erstellen/aktualisieren
function updateChart(data) {
  const labels = data.map(item => item.date);
  const values = data.map(item => item.value);
  
  const chartConfig = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: getMetricLabel(),
        data: values,
        backgroundColor: values.map(value => value >= 0 ? 'rgba(15, 157, 88, 0.7)' : 'rgba(234, 67, 53, 0.7)'),
        borderColor: values.map(value => value >= 0 ? 'rgb(15, 157, 88)' : 'rgb(234, 67, 53)'),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: 'Veränderung in %'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Datum (Jahr-Monat)'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.raw.toFixed(1)}%`;
            }
          }
        }
      }
    }
  };
  
  // Bestehenden Chart zerstören, falls vorhanden
  if (chart) {
    chart.destroy();
  }
  
  // Neuen Chart erstellen
  chart = new Chart(mainChart, chartConfig);
}

// Statistiken berechnen und anzeigen
function updateStatistics(data) {
  if (data.length === 0) {
    averageChangeElement.textContent = '-';
    maxChangeElement.textContent = '-';
    minChangeElement.textContent = '-';
    currentTrendElement.textContent = '-';
    return;
  }
  
  // Durchschnitt berechnen
  const values = data.map(item => item.value);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  
  // Min/Max finden
  const max = Math.max(...values);
  const min = Math.min(...values);
  
  // Trend der letzten 3 Monate berechnen (wenn verfügbar)
  let trend = '-';
  if (data.length >= 3) {
    const recentValues = values.slice(-3);
    let increasingCount = 0;
    let decreasingCount = 0;
    
    for (let i = 1; i < recentValues.length; i++) {
      if (recentValues[i] > recentValues[i-1]) {
        increasingCount++;
      } else if (recentValues[i] < recentValues[i-1]) {
        decreasingCount++;
      }
    }
    
    if (increasingCount > decreasingCount) {
      trend = 'Steigend';
    } else if (decreasingCount > increasingCount) {
      trend = 'Fallend';
    } else {
      trend = 'Stabil';
    }
  }
  
  // Werte anzeigen und Farben setzen
  averageChangeElement.textContent = `${average.toFixed(1)}%`;
  averageChangeElement.className = 'stat-value ' + getValueClass(average);
  
  maxChangeElement.textContent = `${max.toFixed(1)}%`;
  maxChangeElement.className = 'stat-value ' + getValueClass(max);
  
  minChangeElement.textContent = `${min.toFixed(1)}%`;
  minChangeElement.className = 'stat-value ' + getValueClass(min);
  
  currentTrendElement.textContent = trend;
  if (trend === 'Steigend') {
    currentTrendElement.className = 'stat-value positive';
  } else if (trend === 'Fallend') {
    currentTrendElement.className = 'stat-value negative';
  } else {
    currentTrendElement.className = 'stat-value neutral';
  }
}

// Hilffunktionen
function getMetricLabel() {
  const metricOption = metricSelect.options[metricSelect.selectedIndex];
  return metricOption.text;
}

function getValueClass(value) {
  return value >= 0 ? 'positive' : 'negative';
}

function showLoading(show) {
  loadingElement.style.display = show ? 'block' : 'none';
}

function showError(show) {
  errorElement.style.display = show ? 'block' : 'none';
}

// Event-Listener
metricSelect.addEventListener('change', loadData);
timeframeSelect.addEventListener('change', loadData);

// Initial laden
document.addEventListener('DOMContentLoaded', loadData);