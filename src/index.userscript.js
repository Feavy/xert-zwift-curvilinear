import Workout from "./workout/Workout";
import { fetchFtp, fetchWorkoutData } from "./services/XertService";

async function downloadFixedZWO() {
    const workoutData = await fetchWorkoutData();
    const ftp = await fetchFtp();
    const title = WorkoutDetails.$$.ctx[4].name;
    const description =  WorkoutDetails.$$.ctx[4].description;
    const workout = new Workout(workoutData.data, ftp, title, description);
    download(workout.toZwo(), `${title}.zwo`);
}

var download = (function () {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function (data, fileName) {
        var blob = new Blob([data], {type: "octet/stream"}),
            url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

(function() {
    const btns = document.querySelector(".flex.flex-row.flex-wrap.gap-2");
    const newButton = document.createElement("button");
    newButton.className = "focus-visible:ring-ring inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm h-8 rounded-md px-3 text-xs border-0";
    newButton.innerHTML = `<i class="fa-regular fa-download text-xs mr-1" aria-hidden="true"></i>ZWO (fixed)`;
    btns.insertBefore(newButton, btns.childNodes[1]);

    newButton.addEventListener("click", downloadFixedZWO);
})();