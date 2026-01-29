// --- KONFIGURACE MQTT (Z tvého index.html) ---
const MQTT_HOST = "6b21f01c6a0e4cc08a8ae8d7acbcecb5.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884;
const MQTT_USER = "web-client";
const MQTT_PASS = "Lolopolo123"; 

const MQTT_TOPIC_CMD = "light";       // Téma pro tlačítka
const MQTT_TOPIC_GRID = "light/grid"; // Téma pro pixely

// --- PROMĚNNÉ ---
let isDrawing = false;
// Unikátní ID klienta
const clientID = "web_client_" + new Date().getTime();
const client = new Paho.MQTT.Client(MQTT_HOST, MQTT_PORT, clientID);

// --- INIT PO NAČTENÍ STRÁNKY ---
window.onload = function() {
    // 1. Připojení k MQTT
    connectMQTT();

    // 2. Vytvoření mřížky
    createGrid();
    
    // 3. Globální listener pro ukončení kreslení (když pustíš myš i mimo mřížku)
    window.addEventListener('mouseup', () => { isDrawing = false; });
};

// --- MQTT LOGIKA ---
function connectMQTT() {
    const options = {
        useSSL: true,
        userName: MQTT_USER,
        password: MQTT_PASS,
        onSuccess: onConnect,
        onFailure: onFailure
    };
    client.connect(options);
}

function onConnect() {
    console.log("Připojeno k MQTT Brokeru");
    const statusEl = document.getElementById("status");
    if(statusEl) {
        statusEl.innerText = "Stav: PŘIPOJENO (Online)";
        statusEl.style.color = "green";
    }
}

function onFailure(message) {
    console.log("Chyba: " + message.errorMessage);
    const statusEl = document.getElementById("status");
    if(statusEl) {
        statusEl.innerText = "Stav: CHYBA PŘIPOJENÍ";
        statusEl.style.color = "red";
    }
}

function sendMqttMessage(topic, payload) {
    if (!client.isConnected()) {
        console.log("MQTT není připojeno, zpráva neodeslána:", payload);
        return;
    }
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    client.send(message); 
    console.log(`Odesláno do [${topic}]: ${payload}`);
}

// --- LOGIKA MŘÍŽKY ---
function createGrid() {
    const grid = document.getElementById('pixel-grid');
    if (!grid) return; // Ochrana kdyby element neexistoval

    grid.innerHTML = ""; 

    // Generujeme 8 řádků (HTML row 0 je nahoře)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.classList.add('pixel-cell');
            
            // Přepočet souřadnic: Chceme 0:0 vlevo dole
            // HTML Row 0 (nahoře) -> Y = 7
            // HTML Row 7 (dole)   -> Y = 0
            const targetX = col;
            const targetY = 7 - row;

            cell.dataset.x = targetX;
            cell.dataset.y = targetY;

            // Eventy pro myš
            cell.addEventListener('mousedown', (e) => {
                isDrawing = true;
                paintCell(e.target);
            });

            cell.addEventListener('mouseenter', (e) => {
                if (isDrawing) {
                    paintCell(e.target);
                }
            });

            grid.appendChild(cell);
        }
    }
}

function paintCell(cell) {
    const colorPicker = document.getElementById('colorPicker');
    const colorInput = colorPicker ? colorPicker.value : "#ff0000";
    const rgb = hexToRgb(colorInput);
    
    // Obarvení v prohlížeči
    cell.style.backgroundColor = colorInput;

    // Odeslání dat: "x y r g b"
    const x = cell.dataset.x;
    const y = cell.dataset.y;
    const payload = `${x} ${y} ${rgb.r} ${rgb.g} ${rgb.b}`;

    sendMqttMessage(MQTT_TOPIC_GRID, payload);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}
// --- script.js ---

// Funkce pro vyčištění mřížky
function clearGrid() {
    // 1. Odeslání speciálního příkazu "255" do tématu mřížky
    sendMqttMessage(MQTT_TOPIC_GRID, "255");
    
    // 2. Vizuální vyčištění mřížky na webu (optimistický update)
    // Projdeme všechny buňky a nastavíme jim zpět šedou barvu
    const cells = document.querySelectorAll('.pixel-cell');
    cells.forEach(cell => {
        cell.style.backgroundColor = '#eee'; // Barva prázdné buňky (musí sedět s CSS)
    });
    
    console.log("Mřížka vyčištěna.");
}