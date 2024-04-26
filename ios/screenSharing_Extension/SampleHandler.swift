//
//  SampleHandler.swift
//  screenSharing_Extension
//
//  Created by Fred on 17/04/2024.
//

import ReplayKit
//import OSLog //TEMP

private enum Constants {
    // the App Group ID value that the app and the broadcast extension targets are setup with. It differs for each app.
    static let appGroupIdentifier = "group.apirtc.reactNativeApiRTC.broadcast"
}

class SampleHandler: RPBroadcastSampleHandler {

    //var logger = Logger()
  
    private var clientConnection: SocketConnection?
    private var uploader: SampleUploader?
    
    private var frameCount: Int = 0
    var timerDS: DSTimer?
    
    var socketFilePath: String {
      let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Constants.appGroupIdentifier)
        return sharedContainer?.appendingPathComponent("rtc_SSFD").path ?? ""
    }

    override init() {
      super.init()
        if let connection = SocketConnection(filePath: socketFilePath) {
          clientConnection = connection
          setupConnection()
          
          uploader = SampleUploader(connection: connection)
        }
    }
  
    override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
        // User has requested to start the broadcast. Setup info from the UI extension can be supplied but optional. 
        //logger.error("QQQ: broadcastStarted") //TEMP

        //Setting a timer to check if the user has requested to stop the broadcast
        //if broadcastNeedToBeStopped is true, we finish the broadcast with an error
        self.timerDS = DSTimer.schedule(interval: .seconds(1), block: {
            //self.logger.error("QQQ: timer fired")
          
            let valueForBroadcastNeedToBeStopped = UserDefaults(suiteName: "group.apirtc.reactNativeApiRTC.broadcast")?.bool(forKey: "broadcastNeedToBeStopped")

            if (valueForBroadcastNeedToBeStopped == true) {
                //self.logger.error("QQQ: TRUE in timer)")

                // the displayed failure message is more user friendly when using NSError instead of Error
                let JMScreenSharingStopped = 10001
                let customError = NSError(domain: RPRecordingErrorDomain, code: JMScreenSharingStopped, userInfo: [NSLocalizedDescriptionKey: "User has requested screen sharing to be stopped"])
                self.finishBroadcastWithError(customError)

            } //else {
              //self.logger.error("QQQ: ELSE TRUE in timer")
            //}
        }).run()

        frameCount = 0
        
        DarwinNotificationCenter.shared.postNotification(.broadcastStarted)
        openConnection()

        //Sending event to application
        let notificationName = CFNotificationName("com.reactnativeapirtc.notification.broadcaststart" as CFString)
        let notificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(notificationCenter, notificationName, nil, nil, true)
    }
    
    override func broadcastPaused() {
        // User has requested to pause the broadcast. Samples will stop being delivered.
        //logger.error("QQQ: broadcastPaused") //TEMP
    }
    
    override func broadcastResumed() {
        // User has requested to resume the broadcast. Samples delivery will resume.
        //logger.error("QQQ: broadcastResumed") //TEMP
    }
    
    override func broadcastFinished() {
        // User has requested to finish the broadcast.
        //logger.error("QQQ: broadcastFinished") //TEMP
      
        DarwinNotificationCenter.shared.postNotification(.broadcastStopped)
        clientConnection?.close()

        let notificationName = CFNotificationName("com.reactnativeapirtc.notification.broadcaststop" as CFString)
        let notificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(notificationCenter, notificationName, nil, nil, true)
    }
    
    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        switch sampleBufferType {
        case RPSampleBufferType.video:
            // Handle video sample buffer

            // very simple mechanism for adjusting frame rate by using every third frame
            frameCount += 1
            if frameCount % 3 == 0 {
                uploader?.send(sample: sampleBuffer)
            }
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

private extension SampleHandler {

    func setupConnection() {
        clientConnection?.didClose = { [weak self] error in
            print("client connection did close \(String(describing: error))")
          
            if let error = error {
                self?.finishBroadcastWithError(error)
            } else {
                // the displayed failure message is more user friendly when using NSError instead of Error
                let JMScreenSharingStopped = 10001
                let customError = NSError(domain: RPRecordingErrorDomain, code: JMScreenSharingStopped, userInfo: [NSLocalizedDescriptionKey: "Screen sharing stopped"])
                self?.finishBroadcastWithError(customError)
            }
        }
    }
    
    func openConnection() {
        let queue = DispatchQueue(label: "broadcast.connectTimer")
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(500))
        timer.setEventHandler { [weak self] in
            guard self?.clientConnection?.open() == true else {
                return
            }
            
            timer.cancel()
        }
        
        timer.resume()
    }
}
