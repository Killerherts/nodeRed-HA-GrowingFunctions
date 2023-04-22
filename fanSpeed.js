const currentRh = msg.rh;
const requiredRh = msg.req_rh;
const currentTemp = msg.temp;
const desiredTemp = msg.desiredTemperature;
const currentBrightness = msg.brightness || 0;
const maxBrightness = 105;
const minBrightness = 0;
const brightnessScaling = 5; // Set the brightness scaling to a static value of 5

// Calculate the temperature difference
const tempDifference = currentTemp - desiredTemp;

// Calculate the proportion of the temperature difference relative to the temperature range
// Proportion will be 0 when the temperature is equal to or below the desired temperature
const proportion = Math.max(tempDifference / Math.max(Math.abs(tempDifference), 1), 0);

// Calculate the new brightness based on the proportion and the static scaling value
const brightnessChange = proportion * (maxBrightness - minBrightness) * brightnessScaling;

// Calculate brightness based on Rh
let rhBrightness = Math.round(currentRh / requiredRh * maxBrightness);

if (currentTemp < desiredTemp || currentRh < requiredRh) {
    // Set brightness to 0 if the current temperature is below the desired temperature or if the current RH is below the desired RH
    msg.brightness = 0;
} else if (tempDifference > 0 && rhBrightness > msg.brightness) {
    // Increase brightness if the temperature is above the desired value and Rh brightness is higher
    msg.brightness = Math.round(Math.min(rhBrightness + brightnessChange, maxBrightness));
} else if (rhBrightness > msg.brightness) {
    // Update brightness if Rh brightness is higher
    msg.brightness = rhBrightness;
}

return msg;
