import Foundation
import Vision
import AppKit

struct VisionResult: Codable {
    let path: String
    let tags: [String: Float]
    let embedding: [Float]?
    let aestheticScore: Float?
    let error: String?
}

func processImage(at path: String) -> VisionResult {
    let url = URL(fileURLWithPath: path)
    
    // Check if file exists
    guard FileManager.default.fileExists(atPath: path) else {
        return VisionResult(path: path, tags: [:], embedding: nil, aestheticScore: nil, error: "File not found")
    }

    var tags: [String: Float] = [:]
    var embedding: [Float]? = nil
    var aestheticScore: Float? = nil
    
    let requestHandler = VNImageRequestHandler(url: url, options: [:])
    
    // 1. Classification Request (Objects & Scenes)
    let classificationRequest = VNClassifyImageRequest()
    
    // 2. FeaturePrint Request (Semantic Embeddings)
    let featurePrintRequest = VNGenerateImageFeaturePrintRequest()
    
    do {
        try requestHandler.perform([classificationRequest, featurePrintRequest])
        
        // Process Classifications
        if let observations = classificationRequest.results {
            for c in observations.prefix(15) { // Top 15 labels
                if c.confidence > 0.1 {
                    tags[c.identifier] = c.confidence
                }
            }
            
            // Extract Aesthetic Score if available (depends on OS version/model)
            if let aesthetic = observations.first(where: { $0.identifier.contains("Aesthetics") }) {
                aestheticScore = aesthetic.confidence
            }
        }
        
        // Process Embeddings
        if let observation = featurePrintRequest.results?.first {
            // Convert to Float array
            let vector = observation.data
            embedding = vector.withUnsafeBytes { buffer in
                Array(buffer.bindMemory(to: Float.self))
            }
        }
        
        return VisionResult(path: path, tags: tags, embedding: embedding, aestheticScore: aestheticScore, error: nil)
        
    } catch {
        return VisionResult(path: path, tags: [:], embedding: nil, aestheticScore: nil, error: error.localizedDescription)
    }
}

// Main: Parse paths from stdin (JSON format)
let inputData = FileHandle.standardInput.readDataToEndOfFile()
if let paths = try? JSONDecoder().decode([String].self, from: inputData) {
    let results = paths.map { processImage(at: $0) }
    if let outputData = try? JSONEncoder().encode(results) {
        if let outputString = String(data: outputData, encoding: .utf8) {
            print(outputString)
        }
    }
}
