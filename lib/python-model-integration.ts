// This file provides integration with your Python ML model

interface ModelRequest {
  modelType: string
  features: any
}

interface ModelResponse {
  is_anomalous: boolean
  anomaly_type: string | null
  score: number
}

// Function to call your Python ML model API
export async function callPythonModel({ modelType, features }: ModelRequest): Promise<ModelResponse> {
  try {
    // Use the local API endpoint that will run your Python model
    const apiUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ml-model`;

    console.log(`Calling Python model (${modelType}) with features:`, features)

    const response = await fetch(`${apiUrl}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        modelType,
        features,
      }),
    })

    if (!response.ok) {
      throw new Error(`ML service error: ${response.status}`)
    }

    const result = await response.json()
    console.log(`Python model response:`, result)

    return result
  } catch (error) {
    console.error(`Error calling Python model (${modelType}):`, error)
    // Default response in case of error
    return {
      is_anomalous: false,
      anomaly_type: null,
      score: 0,
    }
  }
}

// Enhanced version of the login anomaly detection function
export async function enhancedLoginAnomalyDetection(features: any): Promise<any> {
  try {
    console.log("Calling enhanced login anomaly detection with features:", features)

    // Call your Python model API
    const result = await callPythonModel({
      modelType: "login",
      features,
    })

    return {
      isAnomaly: result.is_anomalous,
      anomalyType: result.anomaly_type,
      score: result.score,
    }
  } catch (error) {
    console.error("Error in enhanced login anomaly detection:", error)
    // Fall back to a simple implementation if the Python model is unavailable
    return {
      isAnomaly: false,
      anomalyType: null,
      score: 0.1,
    }
  }
}

// Enhanced version of the transaction anomaly detection function
export async function enhancedTransactionAnomalyDetection(features: any): Promise<any> {
  try {
    console.log("Calling enhanced transaction anomaly detection with features:", features)

    // Call your Python model API
    const result = await callPythonModel({
      modelType: "transaction",
      features,
    })

    return {
      isAnomaly: result.is_anomalous,
      anomalyType: result.anomaly_type,
      score: result.score,
    }
  } catch (error) {
    console.error("Error in enhanced transaction anomaly detection:", error)
    // Fall back to a simple implementation if the Python model is unavailable
    return {
      isAnomaly: false,
      anomalyType: null,
      score: 0.1,
    }
  }
}
