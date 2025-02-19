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

// Function to fetch prayer times
function fetchPrayerTimes(lat, lon, locationName, country, method) {
    loader.style.display = "block";
    document.getElementById("timingDisplay").style.display = "none";

    const url = `https://api.aladhan.com/v1/timingsByCity?city=${locationName}&country=${country}&method=${method}`;

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

                document.getElementById("arabicDatetime").innerHTML = `${hijriDate.day} ${hijriDate.month.en} ${hijriDate.year} <br> ${gregorian.weekday.en} - ${gregorian.day} ${gregorian.month.en}`;


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
        { name: "Fajr", start: timings.Fajr, end: timings.Sunrise },  // Ends at sunrise
        { name: "Dhuhr", start: timings.Dhuhr, end: timings.Asr },
        { name: "Asr", start: timings.Asr, end: timings.Maghrib },
        { name: "Maghrib", start: timings.Maghrib, end: timings.Isha },
        { name: "Isha", start: timings.Isha, end: "23:59" } // Ends at midnight or Fajr
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

    document.getElementById("currentPrayer").textContent = currentPrayer;
    document.getElementById("nextPrayer").textContent = nextPrayer ? nextPrayer : "Fajr";
    document.getElementById("nextPrayerTime").textContent = nextPrayerTime ? prayerTimes.find(p => p.name === nextPrayer).start : timings.Fajr;

    // Displaying the start and end time of the current prayer
    let activePrayer = prayerTimes.find(p => p.name === currentPrayer);
    if (activePrayer) {
        document.getElementById("currentPrayerStart").textContent = activePrayer.start;
        document.getElementById("currentPrayerEnd").textContent = activePrayer.end;
    }
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

// Function to get user location
function getUserLocation() {
    if (navigator.geolocation) {
        loader.style.display = "block";
        navigator.geolocation.getCurrentPosition(position => {
            let lat = position.coords.latitude;
            let lon = position.coords.longitude;

            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
                .then(response => response.json())
                .then(data => {
                    let districtName = data.address.city || data.address.town || data.address.village || "Your Location";
                    let countryName = data.address.country;
                    document.getElementById("districtSelect").value = districtName;
                    document.getElementById("currentLocation").textContent = `${data.display_name.split(",")[0]},${data.display_name.split(",")[1]},${data.display_name.split(",")[2]}`;

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

// Function to update date & time dynamically
function updateDateTime() {
    const now = new Date();
    document.getElementById("datetime").innerHTML = `${now.toLocaleTimeString()}</span>`;
    // document.getElementById("datetime").innerHTML = `<span>${now.toLocaleDateString()} | ${now.toLocaleTimeString()}</span>`;
}
setInterval(updateDateTime, 1000);

function wrapText(id, maxLength) {
    const element = document.getElementById(id);
    let text = element.innerText || element.textContent;
    if (text.length > maxLength) {
        let wrappedText = '';
        for (let i = 0; i < text.length; i += maxLength) {
            wrappedText += text.substring(i, i + maxLength) + '<br>';
        }
        element.innerHTML = wrappedText;
    }
}

wrapText('detailAddress', 40);
