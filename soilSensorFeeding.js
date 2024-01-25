/**One thhing of note I use a traditional automation to update my
 * highest soil sensor. I find this is easy just to do through the gui
 */

// Constants for Home Assistant Entity IDs
const ENTITY_IDS = {
    darkHours: 'input_number.side_1_dark_hours',
    feedPumpSwitch: 'switch.side_1_feed_pump_switch',
    generative: 'input_boolean.side1_generative_steering',
    highestSoilSensor: 'input_number.highest_soil_sensor_value_side_1',
    lightOnTime: 'input_datetime.side_1_lights_on_time',
    maintenancePhase: 'input_boolean.side1_maintance_phase',
    soilMoisture: 'sensor.vwc_a2_soil_sensor'
};

const debug = false;
const DELAY_FOR_P1_FEED = 18;  // in seconds
const DELAY_FOR_P2_FEED = 21;  // in seconds
const DESIRED_MOISTURE = 45; // Desired moisture level in water content percentage
const MAX_DELTA = 6; //max dryback overnight
const MIN_IRRIGATION_FREQUENCY = 6 * 60; // 10 minutes in seconds
const P1_THRESHOLD = 2;
const P2_THRESHOLD = 7; //dryback % before sending a p2
/**
 * 
 * Nothing needs to be changed under this section unless your modifing 
 * the basic functionality or how the script works. 
 * Modifiy at your own risk
 * 
 */

// For retrieving data:
let currentTime = getCurrentTime();
let currentTimeUTC = getCurrentTimeUTC();
let darkHours = parseFloat(getHAState(ENTITY_IDS.darkHours));
let generative = getHAState(ENTITY_IDS.generative);
let highestSoilsensorVal = getHAState(ENTITY_IDS.highestSoilSensor);
let lightOnTime = convertTimeToSecondsUTC(getHAState(ENTITY_IDS.lightOnTime));
let maintenancePhase = getHAState(ENTITY_IDS.maintenancePhase);
let soilMoisture = parseFloat(getHAState(ENTITY_IDS.soilMoisture));

// Calculate parameters
const SECONDS_IN_DAY = 24 * 60 * 60; 
let lastChangedTimeMs = new Date(global.get('homeassistant').homeAssistant.states[ENTITY_IDS.feedPumpSwitch].last_changed).getTime();
let lightOffTime = calculateLightOffTime(darkHours, lightOnTime);
let irrigationEnd = calculateIrrigationEnd(lightOffTime);
let irrigationStart = calculateIrrigationStart(generative, lightOnTime);
let inIrrigationWindow = checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd);
let lastChanged = convert_epoch_to_utc_seconds(lastChangedTimeMs);
let moistureDifference = DESIRED_MOISTURE - soilMoisture;
let timeSinceLastIrrigation;

//store payloads
let delayAndTurnOffOutput = null;
let flipBooleanOutput = null;
let logOutput = null;
let setInputNumberOutput = null;
let turnOnOutput = null;


//handle midnight crossover
if (lastChanged < currentTimeUTC) {
    timeSinceLastIrrigation = Math.floor(currentTimeUTC - lastChanged);
} else {
    timeSinceLastIrrigation = Math.floor((SECONDS_IN_DAY - lastChanged) + currentTimeUTC);
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

//calculate irrigation end time
function calculateIrrigationEnd(lightOffTime) {
    if (generative == 'on') {
        return lightOffTime - 2 * 60 * 60;
    } else {
        return lightOffTime - 60 * 60;
    }
}

// Function to calculate irrigation start time dynamically based on lights on time
function calculateIrrigationStart(generative, lightOnTime) {
    let irrigationStart = lightOnTime;
    if (generative == "on") {
        irrigationStart = irrigationStart + (2 * 60 * 60); // Add 2 hours for generative steering
    } else {
        // Use a default start time if generative is not enabled
        irrigationStart = irrigationStart + (60 * 60); // Add 1 hour
    }
    return irrigationStart;
}

//check for null states
function checkForNullStates() {
    const requiredStates = ["highestSoilsensorVal", "generative", "darkHours", "lightOnTime", "soilMoisture", "maintenancePhase"];

    const nullStates = requiredStates.filter(state => eval(state) === null);

    if (nullStates.length > 0) {
        // Log and report each null state
        nullStates.forEach(state => {
            const errorMessage = `ERROR: ${state} is null`;
            logOutput = logbookMsg(errorMessage);

            // Create a persistent notification in Home Assistant
            const persistentError = buildPayload('create', 'persistent_notification', '', null, { message: errorMessage, title: 'Irrigation System'});
            node.send([null,null,null,null, persistentError]);
        });
        return true;
    }
}

//converts lastchangems to seconds
function convert_epoch_to_utc_seconds(epoch_ms) {
    const epoch_seconds = epoch_ms / 1000;
    const seconds_into_day_utc = Math.floor(epoch_seconds % SECONDS_IN_DAY);
    return seconds_into_day_utc;
}

// Function to convert a time string in the format HH:MM:SS to seconds from midnight
function convertTimeToSecondsUTC(timeString) {
    // Split the time string by ':' to get hours, minutes, and seconds
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);

    // Calculate the total number of seconds from midnight
    return hours * 3600 + minutes * 60 + seconds;
}

// Function to calculate light off time dynamically based on dark hours
function calculateLightOffTime(darkHours, lightOnTime) {
    let lightDuration = (24 - darkHours) * 60 * 60; // Calculate light duration based on dark hours
    let lightOffTime = (lightOnTime + lightDuration) % SECONDS_IN_DAY; // Adjust for midnight crossover

    return lightOffTime;
}

// Function to check if the current time is within the irrigation window
function checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd) {
    // Normalize times to a 24-hour cycle to handle cases where times span across midnight
    currentTime = currentTime % SECONDS_IN_DAY;
    irrigationStart = irrigationStart % SECONDS_IN_DAY;
    irrigationEnd = irrigationEnd % SECONDS_IN_DAY;

    if (irrigationStart < irrigationEnd) {
        // The irrigation window does not span midnight
        return currentTime >= irrigationStart && currentTime < irrigationEnd;
    } else {
        // The irrigation window spans midnight
        // currentTime must be either after irrigationStart on the same day or before irrigationEnd on the next day
        return currentTime >= irrigationStart || currentTime < irrigationEnd;
    }
}


// Function to get current time in seconds
function getCurrentTime() {
    const now = new Date();
    return now.getSeconds() + (60 * (now.getMinutes() + 60 * now.getHours()));
}

// Function to get current time in UTC seconds
function getCurrentTimeUTC() {
    const now = new Date();
    const utcSeconds = (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds();
    return utcSeconds;
}

// Function to retrieve state from Home Assistant
function getHAState(state) {
    // Check if the states object and the specific state exist
    if (global.get('homeassistant') && global.get('homeassistant').homeAssistant
        && global.get('homeassistant').homeAssistant.states
        && global.get('homeassistant').homeAssistant.states[state]) {
        return global.get('homeassistant').homeAssistant.states[state].state;
    } else {
        // Handle the case where the state or any parent object is undefined
        node.warn("State not found or global object is undefined: " + state);
        return null; // or you can throw an error or return a default value
    }
}


// Enhanced logging for debugging
function logDebugData() {
    if (debug) {
        node.warn("Is in irrigation window? " + inIrrigationWindow);
        node.warn("Generative: " + generative);
        node.warn('Maintance Phase: '+ maintenancePhase)
        node.warn("Dark Hours: " + darkHours);
        node.warn("Soil moisture: " + soilMoisture);
        node.warn("last Irrigation Run " + utcMsToLocalHHMMSS(lastChangedTimeMs));
        node.warn("Highest Sensor Value: " + highestSoilsensorVal);
        // Additional logging to help with debugging
        node.warn("Moisture Difference: " + moistureDifference);
        node.warn("timeSinceLastIrrigation: " + toHHMMSS(timeSinceLastIrrigation));
        node.warn("Current Time: " + new Date(currentTime * 1000).toISOString().substr(11, 8));
        node.warn("Irrigation Start: " + new Date(irrigationStart * 1000).toISOString().substr(11, 8));
        node.warn("Irrigation End: " + new Date(irrigationEnd * 1000).toISOString().substr(11, 8));
    }
}


//function to make logbook entries
function logbookMsg(message) {
    
    // Create a message object with the payload for the api-call-service node
    const logMessage = {
        payload: {
            service_domain: 'logbook',
            service: 'log',
            data: {
            entity_id: ENTITY_IDS.feedPumpSwitch,
            name: "Irrigation System",
            message: message
            }
        }
    };

    return logMessage;
}

//check for min time between irrigation
function minStopTime() {
    if (timeSinceLastIrrigation < MIN_IRRIGATION_FREQUENCY) {
        logOutput = logbookMsg(`Last irrigation was less than ${MIN_IRRIGATION_FREQUENCY / 60} minutes ago. Not performing a check now.`);
        node.send([null,null,null,null, logOutput]);
        return true;
    }
return false;
}

//check for max dryback
function maxDrybackCheck() {
    if (moistureDifference > MAX_DELTA) {
        logOutput = logbookMsg("Max Dryback Feeding");
        turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
        delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P2_FEED);
        node.send([turnOnOutput, delayAndTurnOffOutput, null, null, logOutput]);
        return true;
    }
return false;
}
//reset maintenance phase if outside irrigation window and it is on
function resetMaintenancePhase() {
    if (!inIrrigationWindow && maintenancePhase != 'off') {
        logOutput = logbookMsg("Resetting Maintenance Switch");
        flipBooleanOutput = buildPayload('turn_off', 'input_boolean', ENTITY_IDS.maintenancePhase);
        node.send([null, null, flipBooleanOutput, null, logOutput]);
    }
return false;
}

//reset highest soil sensor at beginging of lights on
function setMaxSoilSensorTracker() {
    //node.warn("set soil warn" + (currentTime -lightOnTime))
    //reset highest soil value sensor at beginging of lights on
    if (Math.abs(currentTime - lightOnTime) <= 60) {
        logOutput = logbookMsg("Flipping Highest Soil Sensor to 0");
        setInputNumberOutput = buildPayload('set_value', 'input_number', ENTITY_IDS.highestSoilSensor, null, { value: 0 });
        node.send([null, null, null, setInputNumberOutput, logOutput]);
        return true;
    }
return false;
}

//switch maintenance phase if in irrigation window and desired moisture is reached
function switchMaintenancePhase() {
    if (maintenancePhase == 'off' && inIrrigationWindow) {
        if (highestSoilsensorVal >= DESIRED_MOISTURE) {
            logOutput = logbookMsg('P2 Flip Switch Desired Moisture Reached');
            flipBooleanOutput = buildPayload('turn_on', 'input_boolean', ENTITY_IDS.maintenancePhase);
            node.send ([null, null, flipBooleanOutput, null, logOutput]);
            return true;
        }
    }
return false;
}
//convert seconds to HH:MM:SS for output only
function toHHMMSS(timeSeconds) {
    const sec = parseInt(timeSeconds, 10); // convert value to number if it's string
    let hours = Math.floor(sec / 3600); // get hours
    let minutes = Math.floor((sec - (hours * 3600)) / 60); // get minutes
    let seconds = sec - (hours * 3600) - (minutes * 60); // get seconds

    // add 0 if value < 10; Example: 2 -> 02
    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }

    return hours + ':' + minutes + ':' + seconds; // Return is HH : MM : SS
}

//convert utc ms to local time HH:MM:SS
function utcMsToLocalHHMMSS(utcMs) {
    var date = new Date(utcMs);
    return date.toLocaleTimeString('en-US', { hour12: false });
}
//run p1 and p2 feeds
function processControlFlow() {
    if (maintenancePhase == 'off' && moistureDifference > P1_THRESHOLD) {
        logOutput = logbookMsg('P1 feed');
        turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
        delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P1_FEED);
        node.send([turnOnOutput, delayAndTurnOffOutput, null, null, logOutput]);
    } else if ( maintenancePhase != 'on' && moistureDifference > P2_THRESHOLD) {
        logOutput = logbookMsg('P2 feed');
        turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
        delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P2_FEED);
        node.send ([turnOnOutput, delayAndTurnOffOutput, null, null, logOutput]);
    }
}

logDebugData();
checkForNullStates();
setMaxSoilSensorTracker();
switchMaintenancePhase();
if (!minStopTime()) {
    if (!maxDrybackCheck()) {
        if (inIrrigationWindow) {
            processControlFlow();
        }
    }   
}
resetMaintenancePhase();