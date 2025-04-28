import { NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

// This API route allows you to directly call your Python ML model from the frontend
// It spawns a Python process to run your model

export async function POST(request: Request) {
  try {
    const { modelType, features } = await request.json()

    if (!modelType || !features) {
      return NextResponse.json({ message: "Model type and features are required" }, { status: 400 })
    }

    console.log(`ML model request received for ${modelType}:`, features)

    // Determine which Python script to run
    const scriptPath = path.join(process.cwd(), "python", "anomaly_detection_model.py")

    // Run the Python script with the features as input
    const result = await runPythonModel(scriptPath, modelType, features)

    console.log(`ML model result:`, result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error calling ML model:", error)
    return NextResponse.json({ message: "Internal server error", error: error.toString() }, { status: 500 })
  }
}

// Function to run a Python script and return the result
async function runPythonModel(scriptPath: string, modelType: string, features: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // Prepare arguments
    const args = [scriptPath, modelType, JSON.stringify(features)]

    console.log(`Running Python script: python ${args.join(" ")}`)

    // Spawn a Python process
    const pythonProcess = spawn("python", args)

    let result = ""
    let error = ""

    // Collect data from stdout
    pythonProcess.stdout.on("data", (data) => {
      result += data.toString()
    })

    // Collect errors from stderr
    pythonProcess.stderr.on("data", (data) => {
      error += data.toString()
      console.error(`Python stderr: ${data.toString()}`)
    })

    // Handle process completion
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`)
        console.error(`Error: ${error}`)

        // Return a default response instead of rejecting
        resolve({
          is_anomalous: false,
          anomaly_type: null,
          score: 0.0,
          error: `Python process failed: ${error}`,
        })
      } else {
        try {
          // Parse the JSON result from the Python script
          const parsedResult = JSON.parse(result)
          resolve(parsedResult)
        } catch (parseError) {
          console.error(`Failed to parse Python result: ${result}`)

          // Return a default response
          resolve({
            is_anomalous: false,
            anomaly_type: null,
            score: 0.0,
            error: `Failed to parse Python result: ${result}`,
          })
        }
      }
    })
  })
}
