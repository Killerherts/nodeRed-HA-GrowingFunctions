/**One thhing of note I use a traditional automation to update my
 * highest soil sensor. I find this is easy just to do through the gui
 */

// Constants for Home Assistant Entity IDs
const ENTITY_IDS = {
    heaterPumpSwitch: 'switch.heater_pump',
    maxTempSensor: 'sensor.max_temp',
    roomTempSensor: 'sensor.room_temp',

};

const delta= 2;  //delta before turning on heater
const debug = true;


// For retrieving data:
let roomTempSensor = getHAState(ENTITY_IDS.roomTempSensor);
let maxTempSensor = getHAState(ENTITY_IDS.maxTempSensor);
let heaterPumpSwitch = getHAState(ENTITY_IDS.heaterPumpSwitch);
/**
 * 
 * Nothing needs to be changed under this section unless your modifing 
 * the basic functionality or how the script works. 
 * Modifiy at your own risk
 * 
 */

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



//check for null states
function checkForNullStates() {
    let nullStates = [];

    if (maxTempSensor === null) nullStates.push("MaxTempSensor");
    if (roomTempSensor === null) nullStates.push("RoomTempSensor");
    if (heaterPumpSwitch === null) nullStates.push("heaterPumpSwitch");

    return nullStates; // Returns an array of null state names, empty if none are null
}




// Enhanced logging for debugging
function logDebugData() {
    if (debug) {
        node.warn("Room Temp Sensor: " + roomTempSensor); //room temp
        node.warn("Max Temp Sensor: " + maxTempSensor); 
        node.warn("Heater Pump Switch: " + heaterPumpSwitch);
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
            entity_id: ENTITY_IDS.heaterPumpSwitch,
            name: "Heater Control System",
            message: message
            }
        }
    };

    return logMessage;
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

function  processControlFlow() {
    const nullStates = checkForNullStates();
    // Get the current state of the heater pump switch
    let logOutput = null;
    let operateHeater = null;

    if (nullStates.length > 0) {
        // Log and report each null state
        nullStates.forEach(state => {
            let errorMessage = `ERROR: ${state} is null`;
            logOutput = logbookMsg(errorMessage);

            // Create a persistent notification in Home Assistant
            let persistentError = buildPayload('create', 'persistent_notification', '', null, { message: errorMessage, title: 'Heating System Error'});
            node.send([null, persistentError]);
        });
        return null;
    }
    
    if (roomTempSensor < maxTempSensor - delta && heaterPumpSwitch === 'off') {
        operateHeater = buildPayload('turn_on', 'switch', ENTITY_IDS.heaterPumpSwitch);
        logOutput = logbookMsg("Heater Turned On "+ roomTempSensor + " Max Temp " + maxTempSensor);
        node.send([operateHeater, logOutput]);
    } else if (roomTempSensor => maxTempSensor && heaterPumpSwitch === 'on') {
        operateHeater = buildPayload('turn_off', 'switch', ENTITY_IDS.heaterPumpSwitch);
        logOutput = logbookMsg("Heater Turned Off "+ roomTempSensor + " Max Temp " + maxTempSensor);
    }
}

processControlFlow();