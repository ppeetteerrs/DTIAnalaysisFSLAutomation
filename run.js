import inquirer from "inquirer";
import shelljs from "shelljs";
import colors from "colors";
import CONFIG from "./config";
import path from "path";
import fs from "fs";

// Program Variables
let subjectList = [];
let actionsList = [];

// File Loading Function
function loadFilePath(subject, fileName, ext = ".nii.gz") {
    log(`Looking for file ${fileName} for ${subject.name}`, 1);
    let rawExists = fs.existsSync(path.join(subject.raw, `${fileName}${ext}`));
    let sharedExists = fs.existsSync(path.join(CONFIG.rawDataDirectory, `${fileName}${ext}`));
    let genExists = fs.existsSync(path.join(subject.generated, `${fileName}${ext}`));
    if (rawExists) {
        log("ok!", 2);
        return path.join(subject.raw, fileName);
    } else if (sharedExists) {
        log("ok, using shared file!", 2);
        return path.join(subject.raw, fileName);
    } else if (genExists) {
        log("ok!", 2);
        return path.join(subject.generated, fileName);
    } else {
        log("Not Found!", 2);
        return null;
    }
}

// Logging Function
function log(message, level = 0) {
    console.log(" ".repeat(level == 0 ? 0 : 4) + message.toString()[level == 0 ? "magenta" : level == 1 ? "cyan" : "yellow"]);
}

// Check FSL Installation and Setup
async function checkEnv() {
    log("Checking FSL installation and commands...");
    let fslLoc = await shelljs.exec("which fsl", {
        silent: true
    }).stdout;
    log(`fsl installed at: ${fslLoc}`, 1);
}

// Get folder names of all subjects
function getSubjects() {
    subjectList = fs.readdirSync(CONFIG.rawDataDirectory).map(name => {
        return {
            name: name,
            raw: path.join(CONFIG.rawDataDirectory, name),
            generated: path.join(CONFIG.generatedDataDirectory, name)
        }
    }).filter((name) => {
        return fs.lstatSync(name.raw).isDirectory();
    });
    if (!subjectList || !subjectList.length || subjectList.length == 0) {
        log("Error: there are no subfolders in the raw data directory, exiting...");
        process.exit(0);
    }
    return subjectList;
}

// Prompt for function
async function promptActionAndSubjects() {
    let {
        actions,
        subjects
    } = await inquirer.prompt([{
        type: "checkbox",
        name: "actions",
        message: "Which actions would you like to perform?",
        choices: [{
            name: "Generate Brain Mask from Topup-corrected Volume(s)",
            value: generateBrainMask
        }, {
            name: "Eddy Current Correction",
            value: eddyCorrection
        }, {
            name: "Fit DTI Data",
            value: dtiFit
        },{
            name: "TBSS Step 1 (it will be performed on all available subjects)",
            value: TBSS1
        },{
            name: "TBSS Step 2 (it will be performed on all available subjects)",
            value: TBSS2
        },{
            name: "TBSS Step 3 (it will be performed on all available subjects)",
            value: TBSS3
        },{
            name: "TBSS Step 4 (it will be performed on all available subjects)",
            value: TBSS4
        }],
    }, {
        type: "checkbox",
        name: "subjects",
        message: "Which subject's data would you like to process?",
        choices: subjectList.map((subject) => {
            return {
                name: subject.name,
                value: subject
            }
        }),
    }]);
    actionsList = actions;
    subjectList = subjects;
    if (!actionsList || !actionsList.length || actionsList.length == 0) {
        log("No actions chosen, exiting...");
        process.exit(0);
    }
    if (!subjectList || !subjectList.length || subjectList.length == 0) {
        log("No subjects chosen, exiting...");
        process.exit(0);
    }
}

// Create Directories
async function makeDirectories() {
    log("Creating Directories...")
    if (!fs.existsSync(CONFIG.generatedDataDirectory)) {
        fs.mkdirSync(CONFIG.generatedDataDirectory);
    }
    if (!fs.existsSync(CONFIG.tbssDirectory)) {
        fs.mkdirSync(CONFIG.tbssDirectory);
    }
    subjectList.forEach((subject) => {
        if (!fs.existsSync(subject.generated)) {
            fs.mkdirSync(subject.generated);
        }
    })
}

// Perform Topup
// async function performTopup(subject) {
//     let inputPath = loadFilePath(subject, CONFIG.rawDataFileName);
//     if (!inputPath) {
//         log("File not found, skipping topup", 1);
//     } else {
//         await shelljs.exec(`fslroi ${inputPath} ${path.join(subject.generated, CONFIG.topup.outputFileName)} ${CONFIG.topup.volumeIndex} ${CONFIG.topup.volumeLength}`)
//         log("Topup completed", 1);
//     }
// }

// Generate Brain Mask
async function generateBrainMask(subject) {
    let inputPath = loadFilePath(subject, CONFIG.brainMask.inputFileName);
    if (!inputPath) {
        log("File not found, skipping brain mask generation", 2);
    } else {
        await shelljs.exec(`fslmaths ${inputPath} -Tmean ${path.join(subject.generated, CONFIG.brainMask.intermediateFileName)}`);
        await shelljs.exec(`bet ${path.join(subject.generated, CONFIG.brainMask.intermediateFileName)} ${path.join(subject.generated, CONFIG.brainMask.outputFileName)} -m -f ${CONFIG.brainMask.threshold}`);
        log("Brain Mask Generation completed", 1);
    }
}

// Correct Eddy Current
// eddy --imain=dwidata --mask=hifi_nodif_brain_mask --index=index.txt --acqp=acqparams.txt --bvecs=bvecs --bvals=bvals --fwhm=0 --topup=topup_AP_PA_b0 --flm=quadratic --out=eddy_unwarped_images
async function eddyCorrection(subject) {
    let inputPath = loadFilePath(subject, CONFIG.rawDataFileName);
    let brainMaskPath = loadFilePath(subject, `${CONFIG.brainMask.outputFileName}_mask`);
    let indexPath = loadFilePath(subject, "index.txt", "");
    let paramsPath = loadFilePath(subject, "acqparams.txt", "");
    let bvecsPath = loadFilePath(subject, "bvecs", "");
    let bvalsPath = loadFilePath(subject, "bvals", "");
    let topupPath = loadFilePath(subject, CONFIG.topup.topupOutputName + "_fieldcoef");
    if (!inputPath || !brainMaskPath || !indexPath || !paramsPath || !bvalsPath || !bvecsPath || !topupPath) {
        log("File not found, skipping eddy correction", 2);
    } else {
        await shelljs.exec(`eddy_openmp --imain=${inputPath} --mask=${brainMaskPath} --index=${indexPath} --acqp=${paramsPath} --bvecs=${bvecsPath} --bvals=${bvalsPath} --fwhm=0 --topup=${topupPath.replace("_fieldcoef", "")} --flm=quadratic --out=${path.join(subject.generated, CONFIG.eddyCorrection.outputFileName)} --data_is_shelled`);
        log("Eddy Correction completed", 1);
    }
}

// DTIFit
//dtifit --data=data --mask=nodif_brain_mask --bvecs=bvecs --bvals=bvals --out=dti
async function dtiFit(subject) {
    let inputPath = loadFilePath(subject, CONFIG.eddyCorrection.outputFileName);
    let brainMaskPath = loadFilePath(subject, CONFIG.dtifit.maskFileName);
    let bvecsPath = loadFilePath(subject, "bvecs", "");
    let bvalsPath = loadFilePath(subject, "bvals", "");
    if (!inputPath || !brainMaskPath || !bvalsPath || !bvecsPath) {
        log("File not found, skipping dtifit", 2);
    } else {
        await shelljs.exec(`dtifit --data=${inputPath} --mask=${brainMaskPath} --bvecs=${bvecsPath} --bvals=${bvalsPath} --out=${path.join(subject.generated, CONFIG.dtifit.outputFileName)}`);
        log("DTIFIT completed", 1);
    }
}

// TBSS
async function TBSS1() {
    subjectList.forEach((subject) => {
        let inputPath = loadFilePath(subject, `${CONFIG.dtifit.outputFileName}_FA.nii.gz`, "");
        fs.copyFileSync(inputPath, path.join(CONFIG.tbssDirectory, `${CONFIG.dtifit.outputFileName}_${subject.name}.nii.gz`));
    });
    await shelljs.cd(path.join(__dirname, CONFIG.tbssDirectory));
    await shelljs.exec(`tbss_1_preproc *.nii.gz`);
}

// TBSS
async function TBSS2() {
    await shelljs.cd(path.join(__dirname, CONFIG.tbssDirectory));
    await shelljs.exec(`tbss_2_reg -T`);
}

// TBSS
async function TBSS3() {
    await shelljs.cd(path.join(__dirname, CONFIG.tbssDirectory));
    await shelljs.exec(`tbss_3_postreg -S`);
}

// TBSS
async function TBSS4() {
    await shelljs.cd(path.join(__dirname, CONFIG.tbssDirectory));
    await shelljs.exec(`tbss_4_prestats ${CONFIG.tbss.FAThreshold}`);
}


async function run() {

    await checkEnv();
    await getSubjects();
    await promptActionAndSubjects();
    await makeDirectories();

    for (let subjectIndex = 0; subjectIndex < subjectList.length; subjectIndex++) {
        log(`Working on ${subjectList[subjectIndex].name}`)
        for (let actionIndex = 0; actionIndex < actionsList.length; actionIndex++) {
            await actionsList[actionIndex](subjectList[subjectIndex]);
        }
        log(`${subjectIndex + 1} / ${subjectList.length} subjects processed`, 1);
    }

}

run();