let generative = global.get('homeassistant').homeAssistant.states['input_boolean.generative_steering_side1'].state === 'on';
let flipToFlower = global.get('homeassistant').homeAssistant.states['input_boolean.flip_to_flower_side1'].state === 'on';
let lightOnTime = convertTime(global.get('homeassistant').homeAssistant.states['input_datetime.lights_on_time_side1'].state);
let soilMoisture = parseFloat(global.get('homeassistant').homeAssistant.states['sensor.soilsensor_moisture_wc'].state);
let previousSoilMoisture = global.get('previousSoilMoisture') || soilMoisture;
let currentTime = new Date().getHours() * 60 * 60 + new Date().getMinutes() * 60 + new Date().getSeconds();

let runoff = Math.abs(previousSoilMoisture - soilMoisture) <= 0.5; // Adjust the threshold as per your requirements

global.set('previousSoilMoisture', soilMoisture); // Save the current soil moisture level for the next cycle

let dryBackThreshold = soilMoisture - 3;

let irrigationStart = generative ? lightOnTime + 2 * 60 * 60 : lightOnTime + 60 * 60;
let lightOffTime = flipToFlower ? lightOnTime + 12 * 60 * 60 : lightOnTime + 18 * 60 * 60;
let irrigationEnd = generative ? lightOffTime - 3 * 60 * 60 : lightOffTime - 60 * 60;

//node.warn("Generative: " + generative);
//node.warn("Flip to flower: " + flipToFlower);
//node.warn("Light on time: " + lightOnTime);
//node.warn("Current soil moisture: " + soilMoisture);
//node.warn("Previous soil moisture: " + previousSoilMoisture);
//node.warn("Runoff detected: " + runoff);
//node.warn("Current time: " + currentTime);
//node.warn("Dry back threshold: " + dryBackThreshold);
//node.warn("Irrigation start time: " + irrigationStart);
//node.warn("Irrigation end time: " + irrigationEnd);

function convertTime(timeString) {
    let time;
    let isUtc = false;

    // When no argument is provided, use the current time
    if (!timeString) {
        time = new Date();
    } else {
        time = new Date(timeString);
        isUtc = timeString.includes("Z") || timeString.includes("+") || timeString.includes("-");
        if (isNaN(time.getTime())) {
            time = new Date("1970-01-01T" + timeString + "Z");
            isUtc = true;
        }
    }

    let hours, minutes, seconds;
    if (isUtc) {
        hours = time.getUTCHours();
        minutes = time.getUTCMinutes();
        seconds = time.getUTCSeconds();
    } else {
        hours = time.getHours();
        minutes = time.getMinutes();
        seconds = time.getSeconds();
    }
    return parseInt(hours * 60 * 60) + parseInt(minutes * 60) + parseInt(seconds);
}

let inIrrigationWindow = (irrigationStart <= currentTime && currentTime <= irrigationEnd) ||
    (irrigationStart > irrigationEnd && currentTime >= irrigationStart) ||
    (irrigationStart > irrigationEnd && currentTime <= irrigationEnd);

if (inIrrigationWindow) {
    if (generative) {
        if (!runoff && soilMoisture < dryBackThreshold) {
            node.warn("Generative irrigation started, soil moisture below dry back threshold.");
            // irrigate
            return { payload: true };
        } else if (runoff || soilMoisture > dryBackThreshold) {
            node.warn("Generative irrigation stopped, soil moisture above dry back threshold or runoff detected.");
            // stop irrigation
            return { payload: false };
        }
    } else {
        node.warn("Non-generative irrigation started.");
        // irrigate
        return { payload: true };
    }
} else {
    node.warn("Outside of irrigation window. Stopping irrigation.");
    // stop irrigation
    return { payload: false };
}
