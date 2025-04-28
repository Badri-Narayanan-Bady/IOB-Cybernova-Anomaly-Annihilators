#!/usr/bin/env python
# Online anomaly detection using River for real-time learning

import sys
import json
import pickle
import os
import numpy as np
from datetime import datetime
import logging
from typing import Dict, Any, Tuple
import joblib

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("online_anomaly_detection.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

try:
    # Import River for online learning
    from river import anomaly, compose, preprocessing, ensemble, tree, metrics, drift
    RIVER_AVAILABLE = True
    logger.info("River package is available for online learning")
except ImportError:
    logger.warning("River package not available. Falling back to static models.")
    RIVER_AVAILABLE = False

# Paths for storing online models
LOGIN_MODEL_PATH = "models/online_login_model.pkl"
TRANSACTION_MODEL_PATH = "models/online_transaction_model.pkl"

# Create models directory if it doesn't exist
os.makedirs("models", exist_ok=True)

class OnlineAnomalyDetector:
    """
    Online anomaly detector that learns in real-time from streaming data
    """
    def __init__(self, model_type: str):
        self.model_type = model_type
        self.model_path = LOGIN_MODEL_PATH if model_type == "login" else TRANSACTION_MODEL_PATH
        self.model = self._initialize_model()
        self.drift_detector = self._initialize_drift_detector()
        
    def _initialize_model(self):
        """Initialize or load the model"""
        if not RIVER_AVAILABLE:
            logger.warning(f"River not available. Cannot initialize online {self.model_type} model.")
            return None
            
        # Try to load existing model
        if os.path.exists(self.model_path):
            try:
                logger.info(f"Loading online {self.model_type} model from {self.model_path}")
                with open(self.model_path, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                logger.error(f"Error loading model: {str(e)}. Creating new model.")
        
        # Create new model based on type
        logger.info(f"Creating new online {self.model_type} model")
        if self.model_type == "login":
            # For login anomaly detection
            return compose.Pipeline(
                preprocessing.StandardScaler(),
                anomaly.HalfSpaceTrees(
                    n_trees=50,
                    height=10,
                    window_size=256,
                    seed=42
                )
            )
        else:
            # For transaction anomaly detection
            return compose.Pipeline(
                preprocessing.StandardScaler(),
                ensemble.AdaptiveRandomForestClassifier(
                    n_models=10,
                    seed=42
                )
            )
    
    def _initialize_drift_detector(self):
        """Initialize drift detector to detect concept drift"""
        if not RIVER_AVAILABLE:
            return None
            
        return drift.ADWIN()
    
    def save_model(self):
        """Save the model to disk"""
        if not RIVER_AVAILABLE or self.model is None:
            return
            
        try:
            logger.info(f"Saving online {self.model_type} model to {self.model_path}")
            with open(self.model_path, 'wb') as f:
                pickle.dump(self.model, f)
        except Exception as e:
            logger.error(f"Error saving model: {str(e)}")
    
    def predict(self, features: Dict[str, Any]) -> Tuple[bool, float]:
        """
        Make a prediction with the current model
        Returns: (is_anomaly, score)
        """
        if not RIVER_AVAILABLE or self.model is None:
            logger.warning("Online model not available. Returning default prediction.")
            return False, 0.0
            
        try:
            # Convert features to the format expected by River
            x = self._prepare_features(features)
            
            # Make prediction
            if self.model_type == "login":
                # For anomaly detection models
                score = self.model.score_one(x)
                is_anomaly = score > 0.7  # Threshold can be adjusted
                return is_anomaly, score
            else:
                # For classification models
                pred_proba = self.model.predict_proba_one(x)
                score = pred_proba.get(1, 0.0)
                is_anomaly = score > 0.7  # Threshold can be adjusted
                return is_anomaly, score
        except Exception as e:
            logger.error(f"Error making prediction: {str(e)}")
            return False, 0.0
    
    def learn(self, features: Dict[str, Any], is_anomaly: bool):
        """
        Update the model with new data
        """
        if not RIVER_AVAILABLE or self.model is None:
            return
            
        try:
            # Convert features to the format expected by River
            x = self._prepare_features(features)
            
            # Update the model
            if self.model_type == "login":
                # For anomaly detection models
                self.model.learn_one(x)
                
                # Check for concept drift
                if self.drift_detector:
                    self.drift_detector.update(float(is_anomaly))
                    if self.drift_detector.drift_detected:
                        logger.info("Concept drift detected! Adjusting model...")
                        # In a real system, you might want to retrain or adjust the model
            else:
                # For classification models
                y = 1 if is_anomaly else 0
                self.model.learn_one(x, y)
                
                # Check for concept drift
                if self.drift_detector:
                    self.drift_detector.update(y)
                    if self.drift_detector.drift_detected:
                        logger.info("Concept drift detected! Adjusting model...")
                        # In a real system, you might want to retrain or adjust the model
                
            # Save the updated model
            self.save_model()
        except Exception as e:
            logger.error(f"Error updating model: {str(e)}")
    
    def _prepare_features(self, features: Dict[str, Any]) -> Dict[str, float]:
        """
        Prepare features for the model
        """
        if self.model_type == "login":
            # Calculate keystroke variance if available
            keystroke_variance = 0.0
            keystroke_timings = features.get('keystroke_timings', [])
            if keystroke_timings and len(keystroke_timings) > 1:
                keystroke_variance = np.var(keystroke_timings)
                
            return {
                'typing_speed': features.get('typing_speed', 0) or 0,
                'cursor_movements': features.get('cursor_movements', 0) or 0,
                'session_duration': features.get('session_duration', 0) or 0,
                'hour': self._extract_hour(features.get('timestamp')),
                'latitude': features.get('latitude', 0) or 0,
                'longitude': features.get('longitude', 0) or 0,
                'keystroke_variance': keystroke_variance
            }
        else:
            # Calculate amount ratio
            from_balance = features.get('from_balance', 0) or 0
            transaction_amount = features.get('transaction_amount', 0) or 0
            amount_ratio = transaction_amount / from_balance if from_balance > 0 else 0
            
            return {
                'transaction_amount': transaction_amount,
                'from_balance': from_balance,
                'amount_ratio': amount_ratio,
                'transaction_frequency': features.get('transaction_frequency', 0) or 0,
                'session_duration': features.get('session_duration', 0) or 0,
                'hour': self._extract_hour(features.get('timestamp')),
                'latitude': features.get('latitude', 0) or 0,
                'longitude': features.get('longitude', 0) or 0,
                'cursor_movements': features.get('cursor_movements', 0) or 0
            }
    
    def _extract_hour(self, timestamp) -> int:
        """Extract hour from timestamp"""
        if not timestamp:
            return datetime.now().hour
            
        try:
            return datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
        except:
            return datetime.now().hour

def detect_anomaly(features, model_type):
    """
    Detect anomalies using both static and online models
    """
    result = None
    
    # First try with the static model
    try:
        if model_type == "login":
            from login_anomaly_detection import detect_login_anomaly
            result = detect_login_anomaly(features)
        else:
            from transaction_anomaly_detection import detect_transaction_anomaly
            result = detect_transaction_anomaly(features)
    except Exception as e:
        logger.error(f"Error using static model: {str(e)}")
    
    # If static model failed or River is available, use online model as well
    if result is None or RIVER_AVAILABLE:
        try:
            # Initialize online detector
            detector = OnlineAnomalyDetector(model_type)
            
            # Make prediction
            is_anomaly, score = detector.predict(features)
            
            if result is None:
                # Use online model result if static model failed
                anomaly_type = None
                if is_anomaly:
                    if model_type == "login":
                        anomaly_type = "Suspicious login behavior (online detection)"
                    else:
                        anomaly_type = "Suspicious transaction behavior (online detection)"
                
                result = {
                    "is_anomalous": is_anomaly,
                    "anomaly_type": anomaly_type,
                    "score": score
                }
            else:
                # Combine results from both models
                static_score = result.get("score", 0)
                combined_score = (static_score + score) / 2
                combined_is_anomalous = result.get("is_anomalous", False) or is_anomaly
                
                result["score"] = combined_score
                result["is_anomalous"] = combined_is_anomalous
                
                # Update anomaly type if needed
                if combined_is_anomalous and not result.get("anomaly_type"):
                    if model_type == "login":
                        result["anomaly_type"] = "Suspicious login behavior (combined detection)"
                    else:
                        result["anomaly_type"] = "Suspicious transaction behavior (combined detection)"
            
            # Learn from this data point
            # In a real system, you would want to confirm if this was actually an anomaly
            # For now, we'll use the prediction as the label
            detector.learn(features, result["is_anomalous"])
            
        except Exception as e:
            logger.error(f"Error using online model: {str(e)}")
            # If online model failed and we don't have a result yet, return a default
            if result is None:
                result = {
                    "is_anomalous": False,
                    "anomaly_type": None,
                    "score": 0.0
                }
    
    return result

if __name__ == "__main__":
    # Read input features and model type from command line arguments
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments. Usage: python online_anomaly_detection.py <model_type> <features_json>"}))
        sys.exit(1)
        
    model_type = sys.argv[1]  # "login" or "transaction"
    features_json = sys.argv[2]
    features = json.loads(features_json)
    
    # Detect anomalies
    result = detect_anomaly(features, model_type)
    
    # Output result as JSON
    print(json.dumps(result))
