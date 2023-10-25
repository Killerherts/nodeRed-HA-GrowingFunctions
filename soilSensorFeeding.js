// Constants for Home Assistant Entity IDs
const ENTITY_IDS = {
    highestSoilSensor: 'input_number.highest_soil_sensor_value_side_1',
    generative: 'input_boolean.side1_generative_steering',
    flipToFlower: 'input_boolean.side1_filp_to_flower',
    lightOnTime: 'input_datetime.side_1_lights_on_time',
    soilMoisture: 'sensor.soil_sesor_a1_moisture_wc',
    maintenancePhase: 'input_boolean.side1_maintance_phase',
    feedPumpSwitch: 'switch.side_1_feed_pump_switch'
};

// Other Constants
const SECONDS_IN_DAY = 24 * 60 * 60;
const MIN_IRRIGATION_FREQUENCY = 1 * 60; // 10 minutes in seconds
const DESIRED_MOISTURE = 46; // Desired moisture level in water content percentage
const P1_THRESHOLD = 2;
const P2_THRESHOLD = 5; //dryback % before sending a p2
const MAX_DELTA = 18; //max dryback overnight
const DELAY_FOR_P1_FEED = 25;  // in seconds
const DELAY_FOR_P2_FEED = 35;  // in seconds
const debug = true;


// For retrieving data:
let highestSoilsensorVal = 42.00; //getHAState(ENTITY_IDS.highestSoilSensor);
let generative = getHAState(ENTITY_IDS.generative) === 'on';
let flipToFlower = getHAState(ENTITY_IDS.flipToFlower) === 'on';
let lightOnTime = convertTime(getHAState(ENTITY_IDS.lightOnTime));
let soilMoisture = 42.00; //parseFloat(getHAState(ENTITY_IDS.soilMoisture));
let maintenancePhase = getHAState(ENTITY_IDS.maintenancePhase) === 'on';
debugWarn('maintenacePhase: ' + maintenancePhase)
let currentTime = getCurrentTime();
let currentTimeUTC = getCurrentTimeUTC();
let timeSinceLastIrrigation;

// Calculate parameters
let lightOffTime = calculateLightOffTime(flipToFlower, lightOnTime);
let irrigationStart = calculateIrrigationStart(generative, lightOnTime);
let irrigationEnd = calculateIrrigationEnd(lightOffTime);
let lastChangedTimeMs = new Date(global.get('homeassistant').homeAssistant.states[ENTITY_IDS.feedPumpSwitch].last_changed).getTime();
let lastChanged = convert_epoch_to_utc_seconds(lastChangedTimeMs);
let inIrrigationWindow = checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd);

if (lastChanged < currentTimeUTC) {
    timeSinceLastIrrigation = Math.floor(currentTimeUTC - lastChanged);
} else {
    timeSinceLastIrrigation = Math.floor((SECONDS_IN_DAY - lastChanged) + currentTimeUTC);
}


// Function to get current time in UTC seconds
function getCurrentTimeUTC() {
    const now = new Date();
    const utcSeconds = (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds();
    return utcSeconds;
}


function convert_epoch_to_utc_seconds(epoch_ms) {
    const epoch_seconds = epoch_ms / 1000;
    const seconds_into_day_utc = Math.floor(epoch_seconds % SECONDS_IN_DAY);
    return seconds_into_day_utc;
}


// Function to convert time2 string
function convertTime(timeString) {
    let time;
    let isUtc = false;

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

// Function to retrieve state from Home Assistant
function getHAState(state) {
    return global.get('homeassistant').homeAssistant.states[state].state;
}

/**
 * Constructs a payload for Home Assistant service calls.
 * 
 * @param {string} service - The service to be called (e.g., 'turn_on', 'turn_off').
 * @param {string} domain - The domain of the entity (e.g., 'switch', 'light').
 * @param {string} entity_id - The id of the entity to be acted upon.
 * @param {number} delay - The delay in seconds before the action is performed.
 * @param {object} data - Any additional data to be passed along with the service call.
 * @returns {object} - The constructed payload.
 */
function buildPayload(service, domain, entity_id, delay = null, data = {}) {
    let payload = {
        service: service,
        domain: domain,
        entity_id: entity_id,
        data: data
    };

    let message = {
        payload: payload
    };

    if (delay !== null) {
        message.delay = delay * 1000; // Convert seconds to milliseconds
    }

    return message;
}
// Whenever you want to build a payload in your processControlFlow function:
// const payload = buildPayload('turn_on', 'switch', 'switch.your_p1_feed_id', DELAY_FOR_P1_FEED);



// Function to get current time in seconds
function getCurrentTime() {
    const now = new Date();
    return now.getSeconds() + (60 * (now.getMinutes() + 60 * now.getHours()));
}


// Function to calculate light off time
function calculateLightOffTime(flipToFlower, lightOnTime) {
    return flipToFlower ? lightOnTime + 12 * 60 * 60 : lightOnTime + 18 * 60 * 60;
}

// Function to calculate irrigation start time dynamically based on lights on time
function calculateIrrigationStart(generative, lightOnTime) {
    let irrigationStart = lightOnTime;

    if (generative) {
        irrigationStart += 2 * 60 * 60; // Add 2 hours for generative steering
    } else {
        // Use a default start time if generative is not enabled
        irrigationStart += 60 * 60; // Add 1 hour
    }

    return irrigationStart;
}

// Function to calculate irrigation end time dynamically based on light off time
function calculateIrrigationEnd(lightOffTime) {
    return (lightOffTime - 60 * 60) % SECONDS_IN_DAY;
}

// Function to check if current time is in irrigation window
function checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd) {
    if (irrigationStart > irrigationEnd) {
        return currentTime >= irrigationStart || currentTime <= irrigationEnd;
    } else {
        return currentTime >= irrigationStart && currentTime <= irrigationEnd;
    }
}

// Process control flow
function logDebugData() {
    if (debug) {
        node.warn("inIrrigationWindow: " + inIrrigationWindow);
        node.warn("Generative: " + generative);
        node.warn("Flip to flower: " + flipToFlower);
        node.warn("Soil moisture: " + soilMoisture);
        node.warn("Current time: " + currentTime);
        node.warn("Irrigation start time: " + irrigationStart);
        node.warn("Irrigation end time: " + irrigationEnd);
        node.warn("last Irrigation Run " + lastChanged);
        node.warn("Highest Sensor Value: " + highestSoilsensorVal);
        node.warn("Last changed Switch:" + lastChangedTimeMs + " ms " + lastChanged)
    }
}

// Modify all your node.warn calls to check the debug flag
function debugWarn(message) {
    if (debug) {
        node.warn(message);
    }
}

function processControlFlow() {
    let turnOnOutput = null;
    let delayAndTurnOffOutput = null;
    let flipBooleanOutput = null;
    let setInputNumberOutput = null;

    if (timeSinceLastIrrigation < MIN_IRRIGATION_FREQUENCY) {
        debugWarn(`Last irrigation was less than ${MIN_IRRIGATION_FREQUENCY / 60} minutes ago. Not performing a check now.`);
        return [null, null, null, null];
    }

    const moistureDifference = DESIRED_MOISTURE - soilMoisture;

    if (Math.abs(moistureDifference) > MAX_DELTA) {
        debugWarn("Max Dryback Feeding");
        turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
        delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P2_FEED);
    } else if (inIrrigationWindow) {
        if (!maintenancePhase) {
            if (moistureDifference <= P1_THRESHOLD || highestSoilsensorVal >= DESIRED_MOISTURE) {
                debugWarn('P2 Flip Switch');
                turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
                delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P2_FEED);
            } else if (moistureDifference > P1_THRESHOLD) {
                debugWarn('P1 feed');
                turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
                delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P1_FEED);
            }
        } else if (moistureDifference > P2_THRESHOLD) {
            debugWarn('P2 feed');
            turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
            delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P2_FEED);
        }
    } else {
        if ((irrigationStart < irrigationEnd && (currentTime > irrigationEnd || currentTime < irrigationStart)) ||
            (irrigationStart > irrigationEnd && !(currentTime > irrigationStart && currentTime < irrigationEnd))) {
            if (maintenancePhase == true) {
                debugWarn("Resetting Maintenance Switch");
                setInputNumberOutput = buildPayload('set_value', 'input_number', ENTITY_IDS.highestSoilSensor, null, {value:0});  // Reset highestSoilSensor value to 0
                flipBooleanOutput = buildPayload('turn_off', 'input_boolean', ENTITY_IDS.maintenancePhase);
            }
        }
    }

     return [turnOnOutput, delayAndTurnOffOutput, flipBooleanOutput, setInputNumberOutput];
}

logDebugData()
// Run the processControlFlow function
return processControlFlow();
