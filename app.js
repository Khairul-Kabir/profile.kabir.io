const districtSelect = document.getElementById("districtSelect");
var selectedCountry = "";
const loader = document.getElementById("loader");
getUserLocation();

// Add 64 districts dynamically
const districts = {
    "Bagerhat": { lat: 22.6581, lon: 89.7850 },
    "Bandarban": { lat: 22.1953, lon: 92.2184 },
    "Barguna": { lat: 22.0953, lon: 90.1121 },
    "Barishal": { lat: 22.7010, lon: 90.3535 },
    "Bhola": { lat: 22.6859, lon: 90.6483 },
    "Bogura": { lat: 24.8481, lon: 89.3720 },
    "Brahmanbaria": { lat: 23.9571, lon: 91.1119 },
    "Chandpur": { lat: 23.2333, lon: 90.6667 },
    "Chattogram": { lat: 22.3569, lon: 91.7832 },
    "Chuadanga": { lat: 23.6402, lon: 88.8411 },
    "Cox's Bazar": { lat: 21.4272, lon: 92.0058 },
    "Cumilla": { lat: 23.4607, lon: 91.1809 },
    "Dhaka": { lat: 23.8103, lon: 90.4125 },
    "Dinajpur": { lat: 25.6217, lon: 88.6350 },
    "Faridpur": { lat: 23.6070, lon: 89.8429 },
    "Feni": { lat: 23.0159, lon: 91.3976 },
    "Gaibandha": { lat: 25.3290, lon: 89.5297 },
    "Gazipur": { lat: 23.9999, lon: 90.4203 },
    "Gopalganj": { lat: 23.0055, lon: 89.8266 },
    "Habiganj": { lat: 24.3750, lon: 91.4167 },
    "Jamalpur": { lat: 24.9370, lon: 89.9371 },
    "Jashore": { lat: 23.1664, lon: 89.2081 },
    "Jhalokathi": { lat: 22.6406, lon: 90.1987 },
    "Jhenaidah": { lat: 23.5441, lon: 89.1539 },
    "Joypurhat": { lat: 25.1024, lon: 89.0250 },
    "Khagrachari": { lat: 23.1194, lon: 91.9843 },
    "Khulna": { lat: 22.8456, lon: 89.5403 },
    "Kishoreganj": { lat: 24.4371, lon: 90.7766 },
    "Kurigram": { lat: 25.8055, lon: 89.6362 },
    "Kushtia": { lat: 23.9013, lon: 89.1205 },
    "Lakshmipur": { lat: 22.9441, lon: 90.8412 },
    "Lalmonirhat": { lat: 25.9923, lon: 89.2847 },
    "Madaripur": { lat: 23.1647, lon: 90.1893 },
    "Magura": { lat: 23.4873, lon: 89.4195 },
    "Manikganj": { lat: 23.8644, lon: 90.0047 },
    "Meherpur": { lat: 23.7621, lon: 88.6318 },
    "Moulvibazar": { lat: 24.4829, lon: 91.7777 },
    "Munshiganj": { lat: 23.5422, lon: 90.5305 },
    "Mymensingh": { lat: 24.7471, lon: 90.4203 },
    "Naogaon": { lat: 24.9131, lon: 88.7530 },
    "Narail": { lat: 23.1725, lon: 89.5129 },
    "Narayanganj": { lat: 23.6238, lon: 90.5000 },
    "Narsingdi": { lat: 23.9322, lon: 90.7156 },
    "Natore": { lat: 24.4111, lon: 89.0085 },
    "Netrokona": { lat: 24.8835, lon: 90.7276 },
    "Nilphamari": { lat: 25.9310, lon: 88.8560 },
    "Noakhali": { lat: 22.8696, lon: 91.0995 },
    "Pabna": { lat: 24.0064, lon: 89.2372 },
    "Panchagarh": { lat: 26.3323, lon: 88.5680 },
    "Patuakhali": { lat: 22.3596, lon: 90.3299 },
    "Pirojpur": { lat: 22.5841, lon: 89.9936 },
    "Rajbari": { lat: 23.7570, lon: 89.6445 },
    "Rajshahi": { lat: 24.3745, lon: 88.6042 },
    "Rangamati": { lat: 22.7324, lon: 92.2985 },
    "Rangpur": { lat: 25.7439, lon: 89.2752 },
    "Satkhira": { lat: 22.7185, lon: 89.0705 },
    "Shariatpur": { lat: 23.2352, lon: 90.3508 },
    "Sherpur": { lat: 25.0205, lon: 90.0153 },
    "Sirajganj": { lat: 24.4534, lon: 89.7002 },
    "Sunamganj": { lat: 25.0658, lon: 91.3951 },
    "Sylhet": { lat: 24.8949, lon: 91.8687 },
    "Tangail": { lat: 24.2513, lon: 89.9166 },
    "Thakurgaon": { lat: 26.0335, lon: 88.4615 }
};

Object.keys(districts).forEach(district => {
    let option = new Option(district, district);
    districtSelect.add(option);
});

// Function to get user location
function getUserLocation() {
    if (navigator.geolocation) {
        loader.style.display = "block";
        navigator.geolocation.getCurrentPosition(fetchWeatherData, showError);
        navigator.geolocation.getCurrentPosition(position => {
            let lat = position.coords.latitude;
            let lon = position.coords.longitude;

            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
                .then(response => response.json())
                .then(data => {
                    let districtName = data.address.city || data.address.town || data.address.village || "Your Location";
                    let countryName = data.address.country;
                    document.getElementById("districtSelect").value = districtName;
                    document.getElementById("currentLocation").textContent = `${data.display_name.split(",")[0]},${data.display_name.split(",")[1]}`;

                    const selectedMethod = document.getElementById("methodSelect").value;

                    fetchPrayerTimes(lat, lon, districtName, countryName, selectedMethod);
                })
                .catch(error => {
                    console.error("Error getting location details:", error);
                    fetchPrayerTimes(lat, lon, selectedCountry, "Your Location","2");
                })
                .finally(() => loader.style.display = "none");
        }, () => alert("Geolocation access denied."));
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}


// Function to fetch prayer times
function fetchPrayerTimes(lat, lon, locationName, country, method) {
    loader.style.display = "block";
    //document.getElementById("timingDisplay").style.display = "none";
    const madhhab = document.querySelector('input[name="madhhab"]:checked').value;
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${locationName}&country=${country}&method=${method}&school=${madhhab}&tune=0,2,1,6,1,3,0,0,0`;
    //const url = `https://api.aladhan.com/v1/timingsByCity?city=${locationName}&country=${country}&method=${method}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.code === 200) {
                const timings = data.data.timings;
                const hijriDate = data.data.date.hijri;
                const gregorian = data.data.date.gregorian;
                document.getElementById("locationName").textContent = locationName;
                document.getElementById("sehriTime").textContent = timings.Fajr;
                document.getElementById("iftarTime").textContent = timings.Maghrib;
                document.getElementById("fajrTime").textContent = timings.Fajr;
                document.getElementById("dhuhrTime").textContent = timings.Dhuhr;
                document.getElementById("asrTime").textContent = timings.Asr;
                document.getElementById("maghribTime").textContent = timings.Maghrib;
                document.getElementById("ishaTime").textContent = timings.Isha;
                document.getElementById("sunriseTime").textContent = timings.Sunrise;
                document.getElementById("sunsetTime").textContent = timings.Sunset;

                // Calculate Salatul Duha Time
                const duhaStart = addMinutesToTime(timings.Sunrise, 15); // Start 15 min after sunrise
                const duhaEnd = subtractMinutesFromTime(timings.Dhuhr, 10); // End 10 min before Dhuhr

                document.getElementById("duhaStartTime").textContent = duhaStart;

                document.getElementById("arabicDatetime").innerHTML = `${hijriDate.day} ${hijriDate.month.en} ${hijriDate.year} <br> ${gregorian.weekday.en} - ${gregorian.day} ${gregorian.month.en}`;

                timings.DuhaStart = duhaStart;
                //timings.DuhaEnd = duhaEnd;
                updateCurrentPrayer(timings);

            } else {
                alert("Error fetching prayer times.");
            }
        })
        .catch(error => console.log("Error fetching data:", error))
        .finally(() => {
            loader.style.display = "none";
            document.getElementById("timingDisplay").style.display = "block";
        });
}

// Update Current Prayer & Countdown
function updateCurrentPrayer(timings) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const prayerTimes = [
        { name: "Fajr", start: timings.Fajr, end: subtractMinutes(timings.Sunrise, 1)},  // Ends at sunrise
        { name: "Salatul Duha", start: timings.DuhaStart, end: subtractMinutes(timings.Dhuhr,1) },
        { name: "Dhuhr", start: timings.Dhuhr, end: subtractMinutes(timings.Asr,1) },
        { name: "Asr", start: timings.Asr, end: subtractMinutes(timings.Maghrib,1) },
        { name: "Maghrib", start: timings.Maghrib, end: subtractMinutes(timings.Isha,1) },
        { name: "Isha", start: timings.Isha, end: "23:59" } // Ends at midnight or Fajr
    ];

    // Forbidden Prayer Times
    const forbiddenTimes = [
        { name: "Forbidden After Fajr", start: prayerTimes[0].end, end: timings.Sunrise },
        { name: "Forbidden Before Dhuhr", start: subtractMinutes(timings.Dhuhr, 5), end: timings.Dhuhr },
        { name: "Forbidden After Asr", start: subtractMinutes(prayerTimes[3].end,15), end: timings.Maghrib }
    ];

    let currentPrayer = "Waiting...";
    let nextPrayer = null;
    let nextPrayerTime = null;

    for (let i = 0; i < prayerTimes.length; i++) {
        let [startH, startM] = prayerTimes[i].start.split(":").map(Number);
        let startTimeInMinutes = startH * 60 + startM;

        let [endH, endM] = prayerTimes[i].end.split(":").map(Number);
        let endTimeInMinutes = endH * 60 + endM;

        if (currentTime < startTimeInMinutes) {
            nextPrayer = prayerTimes[i].name;
            nextPrayerTime = startTimeInMinutes;
            if (i == 0) {
                currentPrayer = prayerTimes[prayerTimes.length - 1].name; // Last prayer (Isha) for early morning
            }
            break;
        } else if (currentTime >= startTimeInMinutes && currentTime < endTimeInMinutes) {
            currentPrayer = prayerTimes[i].name;
            break;
        }
    }

    // Check if it's a forbidden time
    let isForbidden = false;
    for (let i = 0; i < forbiddenTimes.length; i++) {
        let startTimeInMinutes = convertToMinutes(forbiddenTimes[i].start);
        let endTimeInMinutes = convertToMinutes(forbiddenTimes[i].end);

        if (currentTime >= startTimeInMinutes && currentTime < endTimeInMinutes) {
            //currentPrayer = forbiddenTimes[i].name;
            isForbidden = true;
            break;
        }
    }

    document.getElementById("currentPrayer").textContent = currentPrayer;

    // If forbidden time, display warning
    if (isForbidden) {
        document.getElementById("forbiddenMessage").textContent = "It is a forbidden time for voluntary prayer.";
    } else {
        document.getElementById("forbiddenMessage").textContent = "";
    }

    // Displaying the start and end time of the current prayer
    let activePrayer = prayerTimes.find(p => p.name === currentPrayer);
    if (activePrayer) {
        document.getElementById("currentPrayerStart").textContent = activePrayer.start;
        document.getElementById("currentPrayerEnd").textContent = activePrayer.end;
    }

    startCountdown(activePrayer.end,isForbidden);
}

// Function to fetch timings by selected district
function fetchTimingsByDistrict() {
    let selectedDistrict = districtSelect.value;
    if (selectedDistrict) {
        let { lat, lon } = districts[selectedDistrict];
        const selectedMethod = document.getElementById("methodSelect").value;
        selectedCountry = "Bangladesh";
        fetchPrayerTimes(lat, lon, selectedDistrict, selectedCountry, selectedMethod);
    }
}

function fetchSelectedPrayerTimesByMethod() {
    const selectedDistrict = districtSelect.value;
    const { lat, lon } = districts[selectedDistrict];

    // Get the selected calculation method
    const selectedMethod = document.getElementById("methodSelect").value;

    fetchPrayerTimes(lat, lon, selectedDistrict, selectedCountry, selectedMethod);
}

// Function to update date & time dynamically
function updateDateTime() {
    const now = new Date();
    document.getElementById("datetime").innerHTML = `${now.toLocaleTimeString()}</span>`;
    // document.getElementById("datetime").innerHTML = `<span>${now.toLocaleDateString()} | ${now.toLocaleTimeString()}</span>`;
}
setInterval(updateDateTime, 1000);

let countdownInterval;

function startCountdown(endTime,isForbidden) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    function updateCountdown() {
        let now = new Date();
        let [endHour, endMinute] = endTime.split(":").map(Number);
        let end = new Date();
        end.setHours(endHour, endMinute, 0, 0);

        let diff = end - now;
        if (diff <= 0) {
            document.getElementById("countdownTime").textContent = "00:00:00";
            document.getElementById("countdownCircle").style.borderColor = "red";
            clearInterval(countdownInterval); // Stop countdown when time reaches 0
            return;
        }

        let hours = Math.floor(diff / (1000 * 60 * 60));
        let minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById("countdownTime").textContent =
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Change border color dynamically based on time remaining
        let totalDiff = end - now + diff;
        let percentRemaining = (diff / totalDiff) * 100;
        let borderColor = percentRemaining > 50 ? "#FFD700" : percentRemaining > 20 ? "#FFA500" : "#FF0000";
        document.getElementById("countdownCircle").style.borderColor = borderColor;

        if (isForbidden) {
            document.getElementById("countdownCircle").style.borderColor = "red";
            return;
        }
        
    }

    // Run immediately and set interval
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

// Function to add minutes to time (HH:mm format)
function addMinutesToTime(time, minutes) {
    let [hour, min] = time.split(':').map(Number);
    let date = new Date();
    date.setHours(hour);
    date.setMinutes(min + minutes);
    return formatTime(date);
}

// Function to subtract minutes from time (HH:mm format)
function subtractMinutesFromTime(time, minutes) {
    let [hour, min] = time.split(':').map(Number);
    let date = new Date();
    date.setHours(hour);
    date.setMinutes(min - minutes);
    return formatTime(date);
}

// Format time to HH:mm format
function formatTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function updateSelectedMethod() {
    let select = document.getElementById("methodSelect");
    let selectedText = select.options[select.selectedIndex].text;
    document.getElementById("selectedMethod").textContent = selectedText;
    select.classList.add("d-none"); // Hide dropdown
    document.getElementById("selectedMethod").classList.remove("d-none"); // Show text
    fetchSelectedPrayerTimesByMethod(); // Call existing function
}

function showDropdown() {
    document.getElementById("methodSelect").classList.remove("d-none"); // Show dropdown
    document.getElementById("selectedMethod").classList.add("d-none"); // Hide text
}

// Function to fetch weather data from Open-Meteo API
function fetchWeatherData(position) {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    // Open-Meteo API endpoint for current weather
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data && data.current_weather) {
                const temperatureCelsius = data.current_weather.temperature;
                document.getElementById("temperature").textContent = `${temperatureCelsius}°C`;
            } else {
                console.log("Weather data not available.");
            }
        })
        .catch(error => {
            console.log("Error fetching weather data:", error);
        });
}

// Function to handle geolocation errors
function showError(error) {
    switch(error.code) {
        case error.PERMISSION_DENIED:
            alert("User denied the request for Geolocation.");
            break;
        case error.POSITION_UNAVAILABLE:
            alert("Location information is unavailable.");
            break;
        case error.TIMEOUT:
            alert("The request to get user location timed out.");
            break;
        case error.UNKNOWN_ERROR:
            console.log("An unknown error occurred.");
            break;
    }
}

// Utility function to convert HH:MM to minutes
function convertToMinutes(timeStr) {
    let [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

// Utility function to subtract minutes from a time string
function subtractMinutes(timeStr, minutes) {
    let [hours, mins] = timeStr.split(":").map(Number);
    let totalMinutes = hours * 60 + mins - minutes;
    let newHours = Math.floor(totalMinutes / 60);
    let newMinutes = totalMinutes % 60;
    return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
}

// Initialize with the default selected option
document.addEventListener("DOMContentLoaded", () => {
    updateSelectedMethod();
});

