//
//  DSTimer.swift
//  screenSharing_Extension
//  Timer based on DispatchSource
//
//  Created by Fred on 24/04/2024.
//

import Foundation

public final class DSTimer {
    public typealias Block = (() -> Void)
    let timerThread = DispatchQueue(label: "ftimer", qos: .utility)
    var dispatchTimer: DispatchSourceTimer?
    
    init(interval: DispatchTimeInterval, block: @escaping Block) {
        self.dispatchTimer = DispatchSource.makeTimerSource(queue: timerThread)
        self.dispatchTimer?.schedule(deadline: .now(), repeating: .seconds(1))
        self.dispatchTimer?.setEventHandler(handler: {
            block()
        })
    }
    
    public static func schedule(interval: DispatchTimeInterval, block: @escaping Block) -> DSTimer {
        DSTimer.init(interval: interval, block: block)
    }
    
    @discardableResult
    public func run() -> DSTimer {
        dispatchTimer?.resume()
        return self
    }
    
    public func invalidate() {
        dispatchTimer?.cancel()
    }
}
