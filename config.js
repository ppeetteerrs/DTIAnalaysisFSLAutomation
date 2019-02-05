export default {
    // Filename of raw DTI data
    rawDataFileName: "dwidata",
    // Which folder are your raw data located in?
    rawDataDirectory: "data",
    // Which folder would you like to save the generated data in? (same folder if you want to save in same folder as raw data)
    generatedDataDirectory: "generated_data",
    // Which folder would you like to save TBSS data?
    tbssDirectory: "tbss",
    // Settings for topup
    topup: {
        // // Index and length of the volume to extract for topup (i.e. the two arguments passed to fslroi) [Make sure these are the b0 volumes]
        // volumeIndex: 0,
        // volumeLength: 1,
        // // Base output filename
        // outputFileName: "nodif"
        topupOutputName: "topup_AP_PA_b0"
    },
    brainMask: {
        // will run "fslmaths {inputFileName} -Tmean {intermediateFileName}""
        inputFileName: "topup_AP_PA_b0_iout",
        intermediateFileName: "hifi_nodif",
        // will run bet {intermediateFileName} {intermediateFileName} -m -f {threshold}
        outputFileName: "hifi_nodif_brain",
        threshold: 0.2
    },
    eddyCorrection: {
        // eddy --imain={rawDataFileName} --mask={brainMask.outputFileName}_mask --index=index.txt --acqp=acqparams.txt --bvecs=bvecs --bvals=bvals --fwhm=0 --topup=topup_AP_PA_b0 --flm=quadratic --out={outputFileName}
        outputFileName: "eddy_unwarped_images",
    },
    dtifit: {
        maskFileName: "hifi_nodif_brain_mask",
        outputFileName: "dti"
    },
    tbss: {
        FAThreshold: 0.3
    }
}