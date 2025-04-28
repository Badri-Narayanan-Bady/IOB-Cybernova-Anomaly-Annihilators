#!/usr/bin/env python
# Transaction anomaly detection using Random Forest, XGBoost, and River for online learning

import sys
import json
import pickle
import os
import numpy as np
from datetime import datetime
import logging
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("transaction_anomaly_detection.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Path to the ML model files
RF_MODEL_PATH = "models/transaction_rf_model.pkl"
XGB_MODEL_PATH = "models/transaction_xgb_model.pkl"
SCALER_PATH = "models/transaction_scaler.pkl"

# Create models directory if it doesn't exist
os.makedirs("models", exist_ok=True)

def train_initial_models():
    """
    Train initial models if they don't exist
    """
    try:
        # Create synthetic data for initial training
        n_samples = 1000
        
        # Generate normal behavior data (80% of samples)
        normal_samples = int(n_samples * 0.8)
        anomaly_samples = n_samples - normal_samples
        
        # Features: transaction_amount, from_balance, amount_ratio, transaction_frequency, 
        # session_duration, hour, latitude, longitude, cursor_movements
        normal_data = np.random.rand(normal_samples, 9)
        # Normalize to realistic ranges
        normal_data[:, 0] *= 5000  # transaction_amount: 0-5000
        normal_data[:, 1] = normal_data[:, 0] * 10  # from_balance: 10x transaction amount
        normal_data[:, 2] = normal_data[:, 0] / normal_data[:, 1]  # amount_ratio: transaction/balance
        normal_data[:, 3] = np.random.randint(1, 20, size=normal_samples)  # transaction_frequency: 1-20
        normal_data[:, 4] = np.random.randint(30, 300, size=normal_samples)  # session_duration: 30-300 seconds
        normal_data[:, 5] = np.random.randint(8, 20, size=normal_samples)  # hour: 8am-8pm
        normal_data[:, 6] = np.random.uniform(10, 40, size=normal_samples)  # latitude: 10-40
        normal_data[:, 7] = np.random.uniform(70, 100, size=normal_samples)  # longitude: 70-100
        normal_data[:, 8] = np.random.randint(10, 100, size=normal_samples)  # cursor_movements: 10-100
        
        # Generate anomaly data (20% of samples)
        anomaly_data = np.random.rand(anomaly_samples, 9)
        # Make anomalies more extreme
        anomaly_data[:, 0] = np.random.uniform(8000, 20000, size=anomaly_samples)  # very large transactions
        anomaly_data[:, 1] = np.random.uniform(5000, 15000, size=anomaly_samples)  # lower balances
        anomaly_data[:, 2] = anomaly_data[:, 0] / anomaly_data[:, 1]  # high amount_ratio
        anomaly_data[:, 3] = np.random.choice([0, 30], size=anomaly_samples)  # very low or high frequency
        anomaly_data[:, 4] = np.random.choice([5, 600], size=anomaly_samples)  # very short or long sessions
        anomaly_data[:, 5] = np.random.choice([1, 3, 23], size=anomaly_samples)  # unusual hours (night)
        anomaly_data[:, 6] = np.random.uniform(-90, 90, size=anomaly_samples)  # random latitudes
        anomaly_data[:, 7] = np.random.uniform(-180, 180, size=anomaly_samples)  # random longitudes
        anomaly_data[:, 8] = np.random.choice([5, 200], size=anomaly_samples)  # unusual cursor movements
        
        # Combine data and create labels
        X = np.vstack([normal_data, anomaly_data])
        y = np.hstack([np.zeros(normal_samples), np.ones(anomaly_samples)])
        
        # Shuffle the data
        indices = np.arange(n_samples)
        np.random.shuffle(indices)
        X = X[indices]
        y = y[indices]
        
        # Create and fit the scaler
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Train Random Forest model
        rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
        rf_model.fit(X_scaled, y)
        
        # Train XGBoost model
        xgb_model = xgb.XGBClassifier(n_estimators=100, random_state=42)
        xgb_model.fit(X_scaled, y)
        
        # Save models
        joblib.dump(rf_model, RF_MODEL_PATH)
        joblib.dump(xgb_model, XGB_MODEL_PATH)
        joblib.dump(scaler, SCALER_PATH)
        
        logger.info("Initial transaction models trained and saved successfully")
        
        return rf_model, xgb_model, scaler
    
    except Exception as e:
        logger.error(f"Error training initial transaction models: {str(e)}", exc_info=True)
        raise

def load_or_train_models():
    """
    Load existing models or train new ones if they don't exist
    """
    try:
        if (os.path.exists(RF_MODEL_PATH) and 
            os.path.exists(XGB_MODEL_PATH) and 
            os.path.exists(SCALER_PATH)):
            
            logger.info("Loading existing transaction models")
            rf_model = joblib.load(RF_MODEL_PATH)
            xgb_model = joblib.load(XGB_MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
        else:
            logger.info("Training new transaction models")
            rf_model, xgb_model, scaler = train_initial_models()
            
        return rf_model, xgb_model, scaler
    
    except Exception as e:
        logger.error(f"Error loading transaction models: {str(e)}", exc_info=True)
        # Train new models as fallback
        logger.info("Training new transaction models as fallback")
        return train_initial_models()

def detect_transaction_anomaly(features):
    """
    Detect anomalies in transaction behavior using ensemble of models
    """
    try:
        logger.info(f"Starting transaction anomaly detection with features: {features}")
        
        # Load or train models
        rf_model, xgb_model, scaler = load_or_train_models()
        
        # Extract features
        from_account_id = features.get('from_account_id')
        to_account_id = features.get('to_account_id')
        transaction_amount = features.get('transaction_amount', 0)
        from_balance = features.get('from_balance', 0)
        transaction_frequency = features.get('transaction_frequency', 0)
        cursor_movements = features.get('cursor_movements', 0)
        session_duration = features.get('session_duration', 0)
        latitude = features.get('latitude')
        longitude = features.get('longitude')
        
        # Calculate amount ratio
        amount_ratio = 0
        if from_balance > 0:
            amount_ratio = transaction_amount / from_balance
        
        # Parse timestamp to get hour
        timestamp = features.get('timestamp')
        try:
            hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
        except:
            hour = datetime.now().hour
        
        # Prepare features for the model
        model_features = np.array([
            transaction_amount,
            from_balance,
            amount_ratio,
            transaction_frequency,
            session_duration,
            hour,
            latitude if latitude is not None else 0,
            longitude if longitude is not None else 0,
            cursor_movements
        ]).reshape(1, -1)
        
        logger.info(f"Prepared transaction model features: {model_features}")
        
        # Scale features
        scaled_features = scaler.transform(model_features)
        
        # Make predictions with both models
        rf_pred = rf_model.predict(scaled_features)[0]
        rf_prob = rf_model.predict_proba(scaled_features)[0][1]
        
        xgb_pred = xgb_model.predict(scaled_features)[0]
        xgb_prob = xgb_model.predict_proba(scaled_features)[0][1]
        
        # Ensemble prediction (weighted average)
        ensemble_prob = 0.6 * rf_prob + 0.4 * xgb_prob
        ensemble_pred = 1 if ensemble_prob > 0.7 else 0
        
        logger.info(f"Transaction model predictions - RF: {rf_pred} ({rf_prob:.3f}), XGB: {xgb_pred} ({xgb_prob:.3f}), Ensemble: {ensemble_pred} ({ensemble_prob:.3f})")
        
        # Determine anomaly type based on feature analysis
        anomaly_type = None
        if ensemble_pred == 1:
            # Analyze which features contributed most to the anomaly
            if amount_ratio > 0.7:
                anomaly_type = "Unusually large transaction relative to balance"
            elif transaction_amount > 10000:
                anomaly_type = "Unusually large transaction amount"
            elif session_duration is not None and session_duration < 10:
                anomaly_type = "Unusually quick transaction"
            elif hour >= 0 and hour <= 5:
                anomaly_type = "Unusual transaction time (night)"
            else:
                anomaly_type = "Suspicious transaction pattern"
        
        # Update models with this data point (online learning)
        # In a real system, you would want to confirm if this was actually an anomaly
        # before updating the model
        
        result = {
            "is_anomalous": bool(ensemble_pred == 1),
            "anomaly_type": anomaly_type,
            "score": float(ensemble_prob)
        }
        
        logger.info(f"Transaction anomaly detection result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error in transaction anomaly detection: {str(e)}", exc_info=True)
        
        # Fall back to a simple heuristic approach
        anomaly_score = 0.0
        anomaly_type = None
        
        # Check transaction amount (if unusually large)
        if transaction_amount > 10000:
            anomaly_score += 0.3
            anomaly_type = "Unusually large transaction"
        
        # Check amount ratio (if high percentage of balance)
        if amount_ratio > 0.7:
            anomaly_score += 0.4
            anomaly_type = anomaly_type or "High percentage of available balance"
        
        # Check session duration (if too quick)
        if session_duration is not None and session_duration < 10:
            anomaly_score += 0.3
            anomaly_type = anomaly_type or "Unusually quick transaction"
        
        # Check transaction time (if unusual)
        if hour >= 0 and hour <= 5:
            anomaly_score += 0.2
            anomaly_type = anomaly_type or "Unusual transaction time (night)"
        
        # Determine if this is an anomaly
        is_anomalous = anomaly_score >= 0.7
        
        result = {
            "is_anomalous": is_anomalous,
            "anomaly_type": anomaly_type if is_anomalous else None,
            "score": anomaly_score
        }
        
        logger.info(f"Fallback transaction anomaly detection result: {result}")
        return result

if __name__ == "__main__":
    # Read input features from command line argument
    features_json = sys.argv[1] if len(sys.argv) > 1 else "{}"
    features = json.loads(features_json)
    
    # Detect anomalies
    result = detect_transaction_anomaly(features)
    
    # Output result as JSON
    print(json.dumps(result))
