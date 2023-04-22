[
    {
        "id": "9ded306469c47ea5",
        "type": "function",
        "z": "1f61e07f53956bdf",
        "name": "Set Fan Speed Based on temp and current speed",
        "func": "const currentRh = msg.rh;\nconst requiredRh = msg.req_rh;\nconst currentTemp = msg.temp;\nconst desiredTemp = msg.desiredTemperature;\nconst currentBrightness = msg.brightness || 0;\nconst maxBrightness = 105;\nconst minBrightness = 0;\nconst brightnessScaling = 5; // Set the brightness scaling to a static value of 5\n\n// Calculate the temperature difference\nconst tempDifference = currentTemp - desiredTemp;\n\n// Calculate the proportion of the temperature difference relative to the temperature range\n// Proportion will be 0 when the temperature is equal to or below the desired temperature\nconst proportion = Math.max(tempDifference / Math.max(Math.abs(tempDifference), 1), 0);\n\n// Calculate the new brightness based on the proportion and the static scaling value\nconst brightnessChange = proportion * (maxBrightness - minBrightness) * brightnessScaling;\n\n// Calculate brightness based on Rh\nlet rhBrightness = Math.round(currentRh / requiredRh * maxBrightness);\n\nif (currentTemp < desiredTemp || currentRh < requiredRh) {\n    // Set brightness to 0 if the current temperature is below the desired temperature or if the current RH is below the desired RH\n    msg.brightness = 0;\n} else if (tempDifference > 0 && rhBrightness > msg.brightness) {\n    // Increase brightness if the temperature is above the desired value and Rh brightness is higher\n    msg.brightness = Math.round(Math.min(rhBrightness + brightnessChange, maxBrightness));\n} else if (rhBrightness > msg.brightness) {\n    // Update brightness if Rh brightness is higher\n    msg.brightness = rhBrightness;\n}\n\nreturn msg;\n",
        "outputs": 1,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 1170,
        "y": 240,
        "wires": [
            [
                "e8648b1332084d7b",
                "4cc62705090dfdfe"
            ]
        ]
    }
]