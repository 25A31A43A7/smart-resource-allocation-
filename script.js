let resources = JSON.parse(localStorage.getItem("resources")) || {};
let requests = JSON.parse(localStorage.getItem("requests")) || [];

let totalReq = 0, success = 0, mode="";
let barChart, pieChart;

/* for LOGIN page*/
function login(){
    if(localStorage.getItem(user.value) === pass.value){
        window.location.href = "app.html";
    } else alert("Invalid login");
}

function signup(){
    localStorage.setItem(user.value, pass.value);
    alert("Signup successful");
}

/* FORM */
function openForm(t){
    formBox.classList.remove("hidden");
    mode=t;
    formTitle.innerText=t==="add"?"Add Resource":"Request Resource";
    submitBtn.innerText=t==="add"?"Add":"Request";
}

function closeForm(){
    formBox.classList.add("hidden");
}

/* AI */
nameInput.addEventListener("input",()=>{
    let v=nameInput.value.toLowerCase();
    if(v.includes("food")) aiSuggestion.innerText="🔥 High priority";
    else if(v.includes("water")) aiSuggestion.innerText="⚠ Critical";
    else aiSuggestion.innerText="";
});

/*TO gove the VOICE COMMANDS fpr typing  */
function startVoice(){
    let r=new (window.SpeechRecognition||window.webkitSpeechRecognition)();
    r.onresult=e=>nameInput.value=e.results[0][0].transcript;
    r.start();
}

/*for SUBMITTING  */
submitBtn.onclick=()=>{
    let n=nameInput.value.trim(), q=+qtyInput.value;
    if(!n||q<=0) return;

    if(mode==="add"){
        resources[n]=(resources[n]||0)+q;
        notify("Added!");
    } else {
        requests.push({name:n,qty:q,status:"Pending"});
        totalReq++;
        notify("Request Sent!");
    }

    save(); render(); update(); closeForm();
};

/* for the REQUEST LIST */
function render(){
    requestList.innerHTML="";
    requests.forEach((r,i)=>{
        if(r.status==="Pending"){
            let li=document.createElement("li");
            li.innerHTML=`
                ${r.name} (${r.qty})
                <button onclick="approve(${i})">✔</button>
                <button onclick="reject(${i})">✖</button>
            `;
            requestList.appendChild(li);
        }
    });
}

/*to APPROVE or accept the request from the user  */
function approve(i){
    let r=requests[i];
    if(resources[r.name]>=r.qty){
        resources[r.name]-=r.qty;
        r.status="Approved";
        success++;
        notify("Approved!");
    } else {
        r.status="Rejected";
        notify("Rejected!");
    }
    save(); render(); update();
}

/* to REJECT the request recieved by the user*/
function reject(i){
    requests[i].status="Rejected";
    save(); render();
}

/*for an interactive DASHBOARD */
function update(){
    let total=Object.values(resources).reduce((a,b)=>a+b,0);
    totalResources.innerText=total;
    totalRequests.innerText=totalReq;
    successRate.innerText=(totalReq?Math.floor(success/totalReq*100):0)+"%";
    drawChart();
}

/*to display the CHARTS helpful for the remaining or the iteams left in the specific model  */
function drawChart(){

    let labels = Object.keys(resources);
    let data = Object.values(resources);

    if(barChart) barChart.destroy();
    if(pieChart) pieChart.destroy();

    barChart = new Chart(barChart = document.getElementById("barChart"), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Resources',
                data: data,
                borderRadius: 10,
                backgroundColor: ["#00c6ff","#0072ff","#00ffcc","#ff7b00","#ff3c3c"]
            }]
        }
    });

    pieChart = new Chart(document.getElementById("pieChart"), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ["#00c6ff","#0072ff","#00ffcc","#ff7b00","#ff3c3c"]
            }]
        },
        options:{ cutout:"60%" }
    });
}

/*to NOTIFY the user */
function notify(msg){
    let n=document.createElement("div");
    n.innerText=msg;
    n.style.position="fixed";
    n.style.top="10px";
    n.style.right="10px";
    n.style.background="black";
    n.style.padding="10px";
    document.body.appendChild(n);
    setTimeout(()=>n.remove(),2000);
}

/* to save the details */
function save(){
    localStorage.setItem("resources",JSON.stringify(resources));
    localStorage.setItem("requests",JSON.stringify(requests));
}

/* to INIT */
render();
update();
