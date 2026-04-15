let resources = JSON.parse(localStorage.getItem("resources")) || {};
let totalReq = 0;
let success = 0;

/* SWITCH */
function showSection(type) {
    const slider = document.querySelector(".slider");
    slider.style.transform = type === "add" ? "translateX(0%)" : "translateX(-50%)";

    addBtn.classList.toggle("active", type==="add");
    requestBtn.classList.toggle("active", type==="request");
}

/* SAVE */
function saveData() {
    localStorage.setItem("resources", JSON.stringify(resources));
}

/* ADD */
function addResource() {
    let name = resourceName.value.trim();
    let qty = +resourceQty.value;

    if (!name || qty <= 0) return alert("Invalid input");

    resources[name] = (resources[name] || 0) + qty;

    saveData();
    updateDashboard();
    showMessage(`Added ${qty} ${name}`, "success");
}

/* REQUEST */
function requestResource() {
    let name = requestName.value.trim();
    let qty = +requestQty.value;

    if (!name || qty <= 0) return alert("Invalid input");

    totalReq++;

    if (resources[name] >= qty) {
        resources[name] -= qty;
        success++;
        showMessage(`Allocated ${qty} ${name}`, "success");
    } else {
        showMessage(`Not enough ${name}`, "error");
    }

    saveData();
    updateDashboard();
}

/* DASHBOARD */
function updateDashboard() {
    let total = Object.values(resources).reduce((a,b)=>a+b,0);

    totalResources.innerText = total;
    totalRequests.innerText = totalReq;

    let rate = totalReq ? Math.floor(success/totalReq*100) : 0;
    successRate.innerText = rate+"%";
    progressFill.style.width = rate+"%";
}

/* MESSAGE */
function showMessage(msg, type) {
    let li = document.createElement("li");
    li.innerText = msg;
    li.classList.add(type);
    resultList.prepend(li);
}

/* RIPPLE EFFECT */
document.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", function (e) {

        const circle = document.createElement("span");
        circle.classList.add("ripple");

        const rect = this.getBoundingClientRect();

        circle.style.left = (e.clientX - rect.left) + "px";
        circle.style.top = (e.clientY - rect.top) + "px";

        this.appendChild(circle);

        setTimeout(() => circle.remove(), 600);
    });
});

/* CONNECT BUTTONS */
document.querySelectorAll(".card button")[0].onclick = addResource;
document.querySelectorAll(".card button")[1].onclick = requestResource;
let requests = [];
function requestResource() {
    let name = requestName.value.trim();
    let qty = +requestQty.value;

    let request = {
        name,
        qty,
        status: "Pending"
    };

    requests.push(request);

    showMessage(`Request sent for ${qty} ${name}`, "success");
}
function approveRequest(index) {
    let req = requests[index];

    if (resources[req.name] >= req.qty) {
        resources[req.name] -= req.qty;
        req.status = "Approved";
    } else {
        req.status = "Rejected";
    }

    updateDashboard();
}