import { getShaderInfo } from './shaderUtils.js';

const dayNightShaderRaw = document.getElementById("foregroundDayNightShader").innerHTML;
const timeDisplay = document.getElementById("time");
const oopsiesPromptContainer = document.getElementById("oopsieprompt");
const oopsiesText = document.getElementById("oopsies");
const oopsieConfirmation = document.getElementById("oopsieconfirmation");
const newCustomerPromptContainer = document.getElementById("customerprompt");
const description = document.getElementById("description");
const yesButton = document.getElementById("yes");
const noButton = document.getElementById("no");
const DAY_LIMIT = 30;
const DAY_START_HOUR = 6;
const QUADRANTS = 5;
const COLD_CALL_RATE = 5;
const BOOSTED_RATE = 20;
const CURRENT_CUSTOMERS = [];
const CURRENT_NEEDS = [];
const CURRENT_NEEDS_BUTTONS = [];
let backgroundMusic;
let customersLost = 0;
let customersWon = 0
let dayCount = 0;
let currentLocation = [2, 2];
let customerRate = 0;
let hasOjo = false;
let reputation = 100;
let money = 0;
let hoursInDay = 14;
let hoursLeftInDay = hoursInDay;
let adsUp = false;
let promptUp = false;
let textureResources;
let adsButton;
let ojoButton;

PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
PIXI.settings.SORTABLE_CHILDREN = true;
const app = new PIXI.Application({
    width: window.innerWidth, height: window.innerHeight,
    autoResize: true, backgroundColor: 0x1099bb,
    resolution: window.devicePixelRatio || 1, sharedTicker: true
});

document.getElementById("body").appendChild(app.view);

let now = new Date(Date.now());

// Shaders
var curShaderInfo = getShaderInfo(now, sunInfo)
const foregroundDayNightShader = new PIXI.Filter(null, dayNightShaderRaw, curShaderInfo.foreground);

setTime();
var sunInfo = SunCalc.getTimes(now, 30.266666,-97.733330);

// Sprites
const loader = PIXI.Loader.shared;
loader.add('map', 'assets/map2.png')
loader.add('house', 'assets/house.png')
loader.add('ojo', 'assets/ojo.png')
loader.add('ads', 'assets/ads.png')
loader.add('ojo_bw', 'assets/ojo_bw.png')
loader.add('ads_bw', 'assets/ads_bw.png')

let map;
const mapLayer = new PIXI.Container();
const uiLayer = new PIXI.Container();

// The `load` method loads the queue of resources, and calls the passed in callback called once all
// resources have loaded.
loader.load((_, resources) => {
    textureResources = resources;
    map = new PIXI.Sprite(resources['map'].texture);
    
    // set the anchor point so the texture is centered on the sprite
    map.anchor.set(0.5);
    map.filters = [foregroundDayNightShader]
    mapLayer.addChild(map);

    app.stage.addChild(mapLayer);
    app.stage.addChild(uiLayer);

    adsButton = getAdsButton();
    adsButton.position.set(20, window.innerHeight/(window.devicePixelRatio) - 100);
    uiLayer.addChild(adsButton);

    ojoButton = getOjoButton();
    ojoButton.position.set(20, window.innerHeight/(window.devicePixelRatio) - 200);
    uiLayer.addChild(ojoButton);
    
    resize();
    promptStartScreen();
    startInterval();
    document.getElementById("loading").classList.add("hide-opacity");
});

requestAnimationFrame(animate);

function animate()
{
    // time to render the stage !
    app.renderer.render(app.stage);

    // request another animation frame...
    requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);

// Resize function window
function resize() {
    // Resize the renderer
    app.renderer.resize(window.innerWidth, window.innerHeight);

    // You can use the 'screen' property as the renderer visible
    // area, this is more useful than view.width/height because
    // it handles resolution
    if (map){
        map.position.set(window.innerWidth/(window.devicePixelRatio*2), window.innerHeight/(window.devicePixelRatio*2));
        if (map.height > 1) {
            map.height = Math.floor(app.screen.height/window.devicePixelRatio);
            map.width = Math.floor((app.screen.height * map._texture.orig.width/map._texture.orig.height)/window.devicePixelRatio);
        }
    }
}

function setTime() {
    if (hoursLeftInDay == Math.floor(hoursInDay/2)) {
        addNeeds();
    }
    if (hoursLeftInDay <= 0) {
        adsButton.interactive = true;
        adsButton.buttonMode = true;
        adsButton.texture = textureResources["ads"].texture;
        dayCount++;
        if (dayCount == DAY_LIMIT) {
            promptEndScreen();
        } else {
            hoursLeftInDay = hoursInDay;
            const lostNames = new Set();
            const wins = []
            const oopsies = [];
            const completedCustomers = CURRENT_CUSTOMERS.filter((customer) => {return (dayCount - customer.acquired) >= customer.timeline});
            completedCustomers.forEach(customer => {
                let addedMoney = Math.floor(0.06*customer.budget);
                if (customer.selling) { addedMoney = addedMoney * 2;}
                if (hasOjo) { addedMoney = addedMoney * 0.65};
                money += Math.floor(addedMoney);
                CURRENT_CUSTOMERS.splice(CURRENT_CUSTOMERS.indexOf(customer), 1);
                wins.push(`Completed ${customer.name}, gained ${Math.floor(addedMoney)}`)
            })
            CURRENT_NEEDS.map((need) => {return need.customer}).forEach(customer => {
                if (!lostNames.has(customer.name)) {
                    let index = CURRENT_CUSTOMERS.indexOf(customer);
                    CURRENT_CUSTOMERS.splice(index, 1);
                    lostNames.add(customer.name);
                    oopsies.push(`Lost ${customer.name}, potential revenue $${Math.ceil(customer.budget * 0.06)}`)
                }
            });
            CURRENT_NEEDS.splice(0, CURRENT_NEEDS.length);
            addNeeds();
            reputation += wins.length * 2;
            reputation -= oopsies.length * 10;
            customersLost += oopsies.length;
            customersWon += wins.length;
            promptOopsies(oopsies, wins);
        }
    }
    now.setHours(DAY_START_HOUR + hoursInDay - hoursLeftInDay, 0, 0, 0);
    let info = getShaderInfo(now, sunInfo)
    if (info != curShaderInfo) {
        curShaderInfo = info;
        foregroundDayNightShader.uniforms.color = info.foreground.color
        foregroundDayNightShader.uniforms.con_sat_brt = info.foreground.con_sat_brt
    }
    updateTimeDisplay();
}

function promptEndScreen() {
    stopBackgroundMusic();
    promptUp = true;
    oopsiesPromptContainer.style.opacity = 1;
    oopsieConfirmation.disabled = false;
    oopsiesText.innerText = `Money: $${money}\nCustomers lost: ${customersLost}\nCustomers won: ${customersWon}`
    oopsieConfirmation.textContent = "Replay"
    oopsieConfirmation.onclick = () => {window.location.reload()}
}

function addNeeds() {
    for (let i = 0; i < CURRENT_CUSTOMERS.length; i++) {
        let need = getCustomerNeed(CURRENT_CUSTOMERS[i]);
        if (need) {
            CURRENT_NEEDS.push({
                areaOfInterest: need,
                customer: CURRENT_CUSTOMERS[i]
            });
        }
    }
    displayNeeds();
}

function updateTimeDisplay() {
    timeDisplay.innerHTML = `$${money} ${now.toLocaleTimeString()}`;
    timeDisplay.style.opacity = 1
}

function startInterval() {
    setInterval(() => {
        if (!promptUp) {
            hoursLeftInDay -= 1;
            setTime();
        }
    }, 1000);

    setInterval(() => {
        if (!promptUp) {
            customerRate += hasOjo ? BOOSTED_RATE : COLD_CALL_RATE;
            if (adsUp) { customerRate + 5;}
            let rand = 50 + 100 * Math.random() + (100 - reputation);
            if (customerRate > rand) {
                customerRate = 0;
                promptNewCustomer();
            }
        }
    }, 500);
}

function displayNeeds() {
    CURRENT_NEEDS_BUTTONS.forEach(button=> {
        uiLayer.removeChild(button);
        button.destroy();
    })
    CURRENT_NEEDS_BUTTONS.splice(0,CURRENT_NEEDS_BUTTONS.length);

    const offsetStep = 50;
    let curOffset = 0;
    for (var i = 0; i < 5 && i < CURRENT_NEEDS.length; i++) {
        let button = getNeedsButton(CURRENT_NEEDS[i]);
        button.position.set(window.innerWidth/window.devicePixelRatio - 50, 50 + curOffset);
        button._position = {x: button.x, y: button.y};
        uiLayer.addChild(button);
        CURRENT_NEEDS_BUTTONS.push(button);
        curOffset += offsetStep;
    }
}

function getNeedsButton(need) {
    var needsButton = new PIXI.Sprite(textureResources['house'].texture);
    needsButton.zIndex = -10;
    needsButton.interactive = true;
    needsButton.buttonMode = true;
    needsButton.width = 40;
    needsButton.height = 40;

    needsButton.on('pointerdown', () => {
        if (!promptUp) {
            serviceCustomerNeed(need, needsButton);
        }
    });
    return needsButton;
}

function getAdsButton() {
    let button = new PIXI.Sprite(textureResources['ads'].texture);
    button.zIndex = -10;
    button.interactive = true;
    button.buttonMode = true;
    button.width = 40;
    button.height = 40;

    button.on('pointerdown', () => {
        adsUp = true;
        money -= 1000;
        adsButton.interactive = false;
        adsButton.buttonMode = false;
        adsButton.texture = textureResources['ads_bw'].texture
    });
    return button;
}

function getOjoButton() {
    let button = new PIXI.Sprite(textureResources['ojo_bw'].texture);
    button.zIndex = -10;
    button.interactive = true;
    button.buttonMode = true;
    button.width = 40;
    button.height = 40;

    button.on('pointerdown', () => {
        hasOjo = true;
        ojoButton.interactive = false;
        ojoButton.buttonMode = false;
        ojoButton.texture = textureResources['ojo'].texture
    });
    return button;
}

function serviceCustomerNeed(need, needsButton) {
    let index = CURRENT_NEEDS.indexOf(need);
    CURRENT_NEEDS.splice(index, 1);
    let additionalTime = Math.ceil(Math.abs(need.areaOfInterest[0] - currentLocation[0]) + Math.abs(need.areaOfInterest[1] - currentLocation[1])/2)
    hoursLeftInDay -= additionalTime;
    uiLayer.removeChild(needsButton);
    CURRENT_NEEDS_BUTTONS.splice(CURRENT_NEEDS_BUTTONS.indexOf(needsButton), 1);
    currentLocation = need.areaOfInterest;
    displayNeeds();
    setTime();
}

function promptStartScreen(){
    promptUp = true;
    oopsiesPromptContainer.style.opacity = 1;
    oopsieConfirmation.disabled = false;
    oopsiesText.innerText = `Become the Realest Estate Agent around!\nAds cost money and reset every day, but get more leads\nOJO reveals all info and boosts leads\nHouses on right are customer requests. Click to resolve (they cost time)\nYou start in the center of the city each day and move to clients' AOI when needed, costing time\nLosing customers decreases rep until you're the worst ever, so no leads\nGet that cash so you can redistribute wealth, boiiiiiiii`
    oopsieConfirmation.textContent = "START"
    oopsieConfirmation.onclick = () => {
        promptUp = false;
        oopsieConfirmation.disabled = true;
        oopsiesPromptContainer.style.opacity = 0;
        startBackgroundMusic();
    }
}

function promptOopsies(oopsies, wins){
    promptUp = true;
    oopsiesPromptContainer.style.opacity = 1;
    oopsieConfirmation.disabled = false;
    oopsiesText.innerText = `Customers completed:\n${wins.join("\n")}\nCustomers lost:\n${oopsies.join("\n")}\n`
    if (oopsies.length > 0 && wins.length == 0) {
        oopsieConfirmation.textContent = "Ok... :("
    } else if (oopsies.length == 0 && wins.length > 0) {
        oopsieConfirmation.textContent = "Woo!"
    } else {
        oopsieConfirmation.textContent = "Okay"
    }
    oopsieConfirmation.onclick = () => {
        promptUp = false;
        oopsieConfirmation.disabled = true;
        oopsiesPromptContainer.style.opacity = 0;
    }
}

function promptNewCustomer() {
    promptUp = true;
    yesButton.disabled = false;
    noButton.disabled = false;
    newCustomerPromptContainer.style.opacity = 1;
    const customer = newCustomer(hasOjo);
    const timeSink = hasOjo ? 0 : 1;
    hoursLeftInDay -= timeSink;
    setTime();
    description.innerText = customer.promptText;
    yesButton.onclick = () => {
        CURRENT_CUSTOMERS.push(customer);
        closeCustomerPrompt();
    }
    noButton.onclick = () => {
        closeCustomerPrompt();
    }
}

function closeCustomerPrompt() {
    promptUp = false;
    yesButton.disabled = true;
    noButton.disabled = true;
    newCustomerPromptContainer.style.opacity = 0;
}

function getCustomerNeed(customer) {
    if (Math.random() * 10 - 2 < customer.neediness) {
        return customer.areasOfInterest[Math.floor(Math.random() * customer.areasOfInterest.length)]
    }
    return null;
}

function newCustomer(isOjo) {
    let budget = Math.floor(1000000 * Math.random());
    let timeline = 1 + Math.floor(Math.random() * 9)
    let areasOfInterest = generateAreasOfInterest();
    let selling = Math.random() > 0.5;
    let hasLender = Math.random() > 0.1;
    let dataRevealedLimit = isOjo ? 0 : 0.5;
    let promptText = ["Customer Info:"];
    let name = generateName();
    promptText.push(name);
    if (Math.random() > dataRevealedLimit) {
        promptText.push(`Budget: $${budget}`);
    } if (Math.random() > dataRevealedLimit) {
        promptText.push(`Timeline: ${timeline} months`);
    } if (Math.random() > dataRevealedLimit) {
        promptText.push(`Areas of Interest: ${areasOfInterestToDisplay(areasOfInterest)}`);
    } if (Math.random() > dataRevealedLimit) {
        promptText.push(`Selling: ${selling}`);
    } if (Math.random() > dataRevealedLimit) {
        promptText.push(`Has lender: ${hasLender}`);
    }
    return {
        name,
        budget,
        timeline,
        areasOfInterest,
        selling,
        hasLender,
        "promptText": promptText.join("\n"),
        neediness: Math.floor(Math.random() * 10),
        acquired: dayCount
    }
}

function areasOfInterestToDisplay(areasOfInterest) {

    return areasOfInterest.map(areaOfInterestToDisplay).join(", ");
}

function areaOfInterestToDisplay(areaOfInterest) {
    return `${String.fromCharCode(areaOfInterest[0] + 65)}${areaOfInterest[1]+1}`
}

function generateAreasOfInterest() {
    let areas = []
    const numAreas = 1 + Math.floor(Math.random()*5)
    for (let i = 0; i < numAreas; i++) {
        areas.push(
            [
                Math.floor(Math.random()*QUADRANTS),
                Math.floor(Math.random()*QUADRANTS),
            ]
        );
    }
    return areas;
}

function startBackgroundMusic() {
  if (!backgroundMusic) { 
    backgroundMusic = new Audio('assets/music.mp3');
    backgroundMusic.loop = true;
  }
  if (backgroundMusic.paused) {
    backgroundMusic.play();
  }
}

function stopBackgroundMusic() {
  backgroundMusic.pause();
}


/* this is bad */
let maleNames = ["Jacob","Michael","Ethan","Joshua","Daniel","Alexander","Anthony","William","Christopher","Matthew","Jayden","Andrew","Joseph","David","Noah","Aiden","James","Ryan","Logan","John","Nathan","Elijah","Christian","Gabriel","Benjamin","Jonathan","Tyler","Samuel","Nicholas","Gavin","Dylan","Jackson","Brandon","Caleb","Mason","Angel","Isaac","Evan","Jack","Kevin","Jose","Isaiah","Luke","Landon","Justin","Lucas","Zachary","Jordan","Robert","Aaron","Brayden","Thomas","Cameron","Hunter","Austin","Adrian","Connor","Owen","Aidan","Jason","Julian","Wyatt","Charles","Luis","Carter","Juan","Chase","Diego","Jeremiah","Brody","Xavier","Adam","Carlos","Sebastian","Liam","Hayden","Nathaniel","Henry","Jesus","Ian","Tristan","Bryan","Sean","Cole","Alex","Eric","Brian","Jaden","Carson","Blake","Ayden","Cooper","Dominic","Brady","Caden","Josiah","Kyle","Colton","Kaden","Eli","Miguel","Antonio","Parker","Steven","Alejandro","Riley","Richard","Timothy","Devin","Jesse","Victor","Jake","Joel","Colin","Kaleb","Bryce","Levi","Oliver","Oscar","Vincent","Ashton","Cody","Micah","Preston","Marcus","Max","Patrick","Seth","Jeremy","Peyton","Nolan","Ivan","Damian","Maxwell","Alan","Kenneth","Jonah","Jorge","Mark","Giovanni","Eduardo","Grant","Collin","Gage","Omar","Emmanuel","Trevor","Edward","Ricardo","Cristian","Nicolas","Kayden","George","Jaxon","Paul","Braden","Elias","Andres","Derek","Garrett","Tanner","Malachi","Conner","Fernando","Cesar","Javier","Miles","Jaiden","Alexis","Leonardo","Santiago","Francisco","Cayden","Shane","Edwin","Hudson","Travis","Bryson","Erick","Jace","Hector","Josue","Peter","Jaylen","Mario","Manuel","Abraham","Grayson","Damien","Kaiden","Spencer","Stephen","Edgar","Wesley","Shawn","Trenton","Jared","Jeffrey","Landen","Johnathan","Bradley","Braxton","Ryder","Camden","Roman","Asher","Brendan","Maddox","Sergio","Israel","Andy","Lincoln","Erik","Donovan","Raymond","Avery","Rylan","Dalton","Harrison","Andre","Martin","Keegan","Marco","Jude","Sawyer","Dakota","Leo","Calvin","Kai","Drake","Troy","Zion","Clayton","Roberto","Zane","Gregory","Tucker","Rafael","Kingston","Dominick","Ezekiel","Griffin","Devon","Drew","Lukas","Johnny","Ty","Pedro","Tyson","Caiden","Mateo","Braylon","Cash","Aden","Chance","Taylor","Marcos","Maximus","Ruben","Emanuel","Simon","Corbin","Brennan","Dillon","Skyler","Myles","Xander","Jaxson","Dawson","Kameron","Kyler","Axel","Colby","Jonas","Joaquin","Payton","Brock","Frank","Enrique","Quinn","Emilio","Malik","Grady","Angelo","Julio","Derrick","Raul","Fabian","Corey","Gerardo","Dante","Ezra","Armando","Allen","Theodore","Gael","Amir","Zander","Adan","Maximilian","Randy","Easton","Dustin","Luca","Phillip","Julius","Charlie","Ronald","Jakob","Cade","Brett","Trent","Silas","Keith","Emiliano","Trey","Jalen","Darius","Lane","Jerry","Jaime","Scott","Graham","Weston","Braydon","Anderson","Rodrigo","Pablo","Saul","Danny","Donald","Elliot","Brayan","Dallas","Lorenzo","Casey","Mitchell","Alberto","Tristen","Rowan","Jayson","Gustavo","Aaden","Amari","Dean","Braeden","Declan","Chris","Ismael","Dane","Louis","Arturo","Brenden","Felix","Jimmy","Cohen","Tony","Holden","Reid","Abel","Bennett","Zackary","Arthur","Nehemiah","Ricky","Esteban","Cruz","Finn","Mauricio","Dennis","Keaton","Albert","Marvin","Mathew","Larry","Moises","Issac","Philip","Quentin","Curtis","Greyson","Jameson","Everett","Jayce","Darren","Elliott","Uriel","Alfredo","Hugo","Alec","Jamari","Marshall","Walter","Judah","Jay","Lance","Beau","Ali","Landyn","Yahir","Phoenix","Nickolas","Kobe","Bryant","Maurice","Russell","Leland","Colten","Reed","Davis","Joe","Ernesto","Desmond","Kade","Reece","Morgan","Ramon","Rocco","Orlando","Ryker","Brodie","Paxton","Jacoby","Douglas","Kristopher","Gary","Lawrence","Izaiah","Solomon","Nikolas","Mekhi","Justice","Tate","Jaydon","Salvador","Shaun","Alvin","Eddie","Kane","Davion","Zachariah","Dorian","Titus","Kellen","Camron","Isiah","Javon","Nasir","Milo","Johan","Byron","Jasper","Jonathon","Chad","Marc","Kelvin","Chandler","Sam","Cory","Deandre","River","Reese","Roger","Quinton","Talon","Romeo","Franklin","Noel","Alijah","Guillermo","Gunner","Damon","Jadon","Emerson","Micheal","Bruce","Terry","Kolton","Melvin","Beckett","Porter","August","Brycen","Dayton","Jamarion","Leonel","Karson","Zayden","Keagan","Carl","Khalil","Cristopher","Nelson","Braiden","Moses","Isaias","Roy","Triston","Walker","Kale","Jermaine","Leon","Rodney","Kristian","Mohamed"];
let femaleNames = ["Emma","Isabella","Emily","Madison","Ava","Olivia","Sophia","Abigail","Elizabeth","Chloe","Samantha","Addison","Natalie","Mia","Alexis","Alyssa","Hannah","Ashley","Ella","Sarah","Grace","Taylor","Brianna","Lily","Hailey","Anna","Victoria","Kayla","Lillian","Lauren","Kaylee","Allison","Savannah","Nevaeh","Gabriella","Sofia","Makayla","Avery","Riley","Julia","Leah","Aubrey","Jasmine","Audrey","Katherine","Morgan","Brooklyn","Destiny","Sydney","Alexa","Kylie","Brooke","Kaitlyn","Evelyn","Layla","Madeline","Kimberly","Zoe","Jessica","Peyton","Alexandra","Claire","Madelyn","Maria","Mackenzie","Arianna","Jocelyn","Amelia","Angelina","Trinity","Andrea","Maya","Valeria","Sophie","Rachel","Vanessa","Aaliyah","Mariah","Gabrielle","Katelyn","Ariana","Bailey","Camila","Jennifer","Melanie","Gianna","Charlotte","Paige","Autumn","Payton","Faith","Sara","Isabelle","Caroline","Genesis","Isabel","Mary","Zoey","Gracie","Megan","Haley","Mya","Michelle","Molly","Stephanie","Nicole","Jenna","Natalia","Sadie","Jada","Serenity","Lucy","Ruby","Eva","Kennedy","Rylee","Jayla","Naomi","Rebecca","Lydia","Daniela","Bella","Keira","Adriana","Lilly","Hayden","Miley","Katie","Jade","Jordan","Gabriela","Amy","Angela","Melissa","Valerie","Giselle","Diana","Amanda","Kate","Laila","Reagan","Jordyn","Kylee","Danielle","Briana","Marley","Leslie","Kendall","Catherine","Liliana","Mckenzie","Jacqueline","Ashlyn","Reese","Marissa","London","Juliana","Shelby","Cheyenne","Angel","Daisy","Makenzie","Miranda","Erin","Amber","Alana","Ellie","Breanna","Ana","Mikayla","Summer","Piper","Adrianna","Jillian","Sierra","Jayden","Sienna","Alicia","Lila","Margaret","Alivia","Brooklynn","Karen","Violet","Sabrina","Stella","Aniyah","Annabelle","Alexandria","Kathryn","Skylar","Aliyah","Delilah","Julianna","Kelsey","Khloe","Carly","Amaya","Mariana","Christina","Alondra","Tessa","Eliana","Bianca","Jazmin","Clara","Vivian","Josephine","Delaney","Scarlett","Elena","Cadence","Alexia","Maggie","Laura","Nora","Ariel","Elise","Nadia","Mckenna","Chelsea","Lyla","Alaina","Jasmin","Hope","Leila","Caitlyn","Cassidy","Makenna","Allie","Izabella","Eden","Callie","Haylee","Caitlin","Kendra","Karina","Kyra","Kayleigh","Addyson","Kiara","Jazmine","Karla","Camryn","Alina","Lola","Kyla","Kelly","Fatima","Tiffany","Kira","Crystal","Mallory","Esmeralda","Alejandra","Eleanor","Angelica","Jayda","Abby","Kara","Veronica","Carmen","Jamie","Ryleigh","Valentina","Allyson","Dakota","Kamryn","Courtney","Cecilia","Madeleine","Aniya","Alison","Esther","Heaven","Aubree","Lindsey","Leilani","Nina","Melody","Macy","Ashlynn","Joanna","Cassandra","Alayna","Kaydence","Madilyn","Aurora","Heidi","Emerson","Kimora","Madalyn","Erica","Josie","Katelynn","Guadalupe","Harper","Ivy","Lexi","Camille","Savanna","Dulce","Daniella","Lucia","Emely","Joselyn","Kiley","Kailey","Miriam","Cynthia","Rihanna","Georgia","Rylie","Harmony","Kiera","Kyleigh","Monica","Bethany","Kaylie","Cameron","Teagan","Cora","Brynn","Ciara","Genevieve","Alice","Maddison","Eliza","Tatiana","Jaelyn","Erika","Ximena","April","Marely","Julie","Danica","Presley","Brielle","Julissa","Angie","Iris","Brenda","Hazel","Rose","Malia","Shayla","Fiona","Phoebe","Nayeli","Paola","Kaelyn","Selena","Audrina","Rebekah","Carolina","Janiyah","Michaela","Penelope","Janiya","Anastasia","Adeline","Ruth","Sasha","Denise","Holly","Madisyn","Hanna","Tatum","Marlee","Nataly","Helen","Janelle","Lizbeth","Serena","Anya","Jaslene","Kaylin","Jazlyn","Nancy","Lindsay","Desiree","Hayley","Itzel","Imani","Madelynn","Asia","Kadence","Madyson","Talia","Jane","Kayden","Annie","Amari","Bridget","Raegan","Jadyn","Celeste","Jimena","Luna","Yasmin","Emilia","Annika","Estrella","Sarai","Lacey","Ayla","Alessandra","Willow","Nyla","Dayana","Lilah","Lilliana","Natasha","Hadley","Harley","Priscilla","Claudia","Allisson","Baylee","Brenna","Brittany","Skyler","Fernanda","Danna","Melany","Cali","Lia","Macie","Lyric","Logan","Gloria","Lana","Mylee","Cindy","Lilian","Amira","Anahi","Alissa","Anaya","Lena","Ainsley","Sandra","Noelle","Marisol","Meredith","Kailyn","Lesly","Johanna","Diamond","Evangeline","Juliet","Kathleen","Meghan","Paisley","Athena","Hailee","Rosa","Wendy","Emilee","Sage","Alanna","Elaina","Cara","Nia","Paris","Casey","Dana","Emery","Rowan","Aubrie","Kaitlin","Jaden","Kenzie","Kiana","Viviana","Norah","Lauryn","Perla","Amiyah","Alyson","Rachael","Shannon","Aileen","Miracle","Lillie","Danika","Heather","Kassidy","Taryn","Tori","Francesca","Kristen","Amya","Elle","Kristina","Cheyanne","Haylie","Patricia","Anne","Samara","Skye","Kali","America","Lexie","Parker","Halle","Londyn","Abbigail","Linda","Hallie","Saniya","Bryanna","Bailee","Jaylynn","Mckayla","Quinn","Jaelynn","Jaida","Caylee","Jaiden","Melina","Abril","Sidney","Kassandra","Elisabeth","Adalyn","Kaylynn","Mercedes","Yesenia","Elliana","Brylee","Dylan","Isabela","Ryan","Ashlee","Daphne","Kenya","Marina","Christine","Mikaela","Kaitlynn","Justice","Saniyah","Jaliyah","Ingrid","Marie","Natalee","Joy","Juliette","Simone","Adelaide","Krystal","Kennedi","Mila","Tamia","Addisyn","Aylin","Dayanara","Sylvia","Clarissa","Maritza","Virginia","Braelyn","Jolie","Jaidyn","Kinsley","Kirsten","Laney","Marilyn","Whitney","Janessa","Raquel","Anika","Kamila","Aria","Rubi","Adelyn","Amara","Ayanna","Teresa","Zariah","Kaleigh"];
let surnames = ["Smith","Johnson","Williams","Brown","Jones","Miller","Davis","Garcia","Rodriguez","Wilson","Martinez","Anderson","Taylor","Thomas","Hernandez","Moore","Martin","Jackson","Thompson","White","Lopez","Lee","Gonzalez","Harris","Clark","Lewis","Robinson","Walker","Perez","Hall","Young","Allen","Sanchez","Wright","King","Scott","Green","Baker","Adams","Nelson","Hill","Ramirez","Campbell","Mitchell","Roberts","Carter","Phillips","Evans","Turner","Torres","Parker","Collins","Edwards","Stewart","Flores","Morris","Nguyen","Murphy","Rivera","Cook","Rogers","Morgan","Peterson","Cooper","Reed","Bailey","Bell","Gomez","Kelly","Howard","Ward","Cox","Diaz","Richardson","Wood","Watson","Brooks","Bennett","Gray","James","Reyes","Cruz","Hughes","Price","Myers","Long","Foster","Sanders","Ross","Morales","Powell","Sullivan","Russell","Ortiz","Jenkins","Gutierrez","Perry","Butler","Barnes","Fisher","Henderson","Coleman","Simmons","Patterson","Jordan","Reynolds","Hamilton","Graham","Kim","Gonzales","Alexander","Ramos","Wallace","Griffin","West","Cole","Hayes","Chavez","Gibson","Bryant","Ellis","Stevens","Murray","Ford","Marshall","Owens","Mcdonald","Harrison","Ruiz","Kennedy","Wells","Alvarez","Woods","Mendoza","Castillo","Olson","Webb","Washington","Tucker","Freeman","Burns","Henry","Vasquez","Snyder","Simpson","Crawford","Jimenez","Porter","Mason","Shaw","Gordon","Wagner","Hunter","Romero","Hicks","Dixon","Hunt","Palmer","Robertson","Black","Holmes","Stone","Meyer","Boyd","Mills","Warren","Fox","Rose","Rice","Moreno","Schmidt","Patel","Ferguson","Nichols","Herrera","Medina","Ryan","Fernandez","Weaver","Daniels","Stephens","Gardner","Payne","Kelley","Dunn","Pierce","Arnold","Tran","Spencer","Peters","Hawkins","Grant","Hansen","Castro","Hoffman","Hart","Elliott","Cunningham","Knight","Bradley","Carroll","Hudson","Duncan","Armstrong","Berry","Andrews","Johnston","Ray","Lane","Riley","Carpenter","Perkins","Aguilar","Silva","Richards","Willis","Matthews","Chapman","Lawrence","Garza","Vargas","Watkins","Wheeler","Larson","Carlson","Harper","George","Greene","Burke","Guzman","Morrison","Munoz","Jacobs","Obrien","Lawson","Franklin","Lynch","Bishop","Carr","Salazar","Austin","Mendez","Gilbert","Jensen","Williamson","Montgomery","Harvey","Oliver","Howell","Dean","Hanson","Weber","Garrett","Sims","Burton","Fuller","Soto","Mccoy","Welch","Chen","Schultz","Walters","Reid","Fields","Walsh","Little","Fowler","Bowman","Davidson","May","Day","Schneider","Newman","Brewer","Lucas","Holland","Wong","Banks","Santos","Curtis","Pearson","Delgado","Valdez","Pena","Rios","Douglas","Sandoval","Barrett","Hopkins","Keller","Guerrero","Stanley","Bates","Alvarado","Beck","Ortega","Wade","Estrada","Contreras","Barnett","Caldwell","Santiago","Lambert","Powers","Chambers","Nunez","Craig","Leonard","Lowe","Rhodes","Byrd","Gregory","Shelton","Frazier","Becker","Maldonado","Fleming","Vega","Sutton","Cohen","Jennings","Parks","Mcdaniel","Watts","Barker","Norris","Vaughn","Vazquez","Holt","Schwartz","Steele","Benson","Neal","Dominguez","Horton","Terry","Wolfe","Hale","Lyons","Graves","Haynes","Miles","Park","Warner","Padilla","Bush","Thornton","Mccarthy","Mann","Zimmerman","Erickson","Fletcher","Mckinney","Page","Dawson","Joseph","Marquez","Reeves","Klein","Espinoza","Baldwin","Moran","Love","Robbins","Higgins","Ball","Cortez","Le","Griffith","Bowen","Sharp","Cummings","Ramsey","Hardy","Swanson","Barber","Acosta","Luna","Chandler","Blair","Daniel","Cross","Simon","Dennis","Oconnor","Quinn","Gross","Navarro","Moss","Fitzgerald","Doyle","Mclaughlin","Rojas","Rodgers","Stevenson","Singh","Yang","Figueroa","Harmon","Newton","Paul","Manning","Garner","Mcgee","Reese","Francis","Burgess","Adkins","Goodman","Curry","Brady","Christensen","Potter","Walton","Goodwin","Mullins","Molina","Webster","Fischer","Campos","Avila","Sherman","Todd","Chang","Blake","Malone","Wolf","Hodges","Juarez","Gill","Farmer","Hines","Gallagher","Duran","Hubbard","Cannon","Miranda","Wang","Saunders","Tate","Mack","Hammond","Carrillo","Townsend","Wise","Ingram","Barton","Mejia","Ayala","Schroeder","Hampton"];
 
  function generateName(gender) {
      if (!gender) {
          if (Math.random() > 0.5) {
              gender = "female";
          } else {
              gender = "male";
          }
      }
      if (gender == "female") {
          return `${femaleNames[Math.floor(Math.random() * femaleNames.length)]} ${surnames[Math.floor(Math.random() * surnames.length)]}`
      }
      return `${maleNames[Math.floor(Math.random() * maleNames.length)]} ${surnames[Math.floor(Math.random() * surnames.length)]}` 
  }