//
//  SampleHandler.swift
//  screenSharing_Extension
//
//  Created by Fred on 17/04/2024.
//

import ReplayKit
import OSLog //TEMP

private enum Constants {
    // the App Group ID value that the app and the broadcast extension targets are setup with. It differs for each app.
    static let appGroupIdentifier = "group.apirtc.reactNativeApiRTC.broadcast"
}

class SampleHandler: RPBroadcastSampleHandler {

    var logger = Logger() //TEMP

    override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
        // User has requested to start the broadcast. Setup info from the UI extension can be supplied but optional. 
        logger.error("QQQ: broadcastStarted") //TEMP
    }
    
    override func broadcastPaused() {
        // User has requested to pause the broadcast. Samples will stop being delivered.
        logger.error("QQQ: broadcastPaused") //TEMP
    }
    
    override func broadcastResumed() {
        // User has requested to resume the broadcast. Samples delivery will resume.
        logger.error("QQQ: broadcastResumed") //TEMP
    }
    
    override func broadcastFinished() {
        // User has requested to finish the broadcast.
        logger.error("QQQ: broadcastFinished") //TEMP
    }
    
    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        switch sampleBufferType {
        case RPSampleBufferType.video:
            // Handle video sample buffer
            break
        case RPSampleBufferType.audioApp:
            // Handle audio sample buffer for app audio
            break
        case RPSampleBufferType.audioMic:
            // Handle audio sample buffer for mic audio
            break
        @unknown default:
            // Handle other sample buffer types
            fatalError("Unknown type of sample buffer")
        }
    }
}
