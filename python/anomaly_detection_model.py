#!/usr/bin/env python
# Anomaly detection model for IOB Banking

import sys
import json
import pickle
import os
import numpy as np
from datetime import datetime
import logging
from typing import Dict, Any, Tuple
import joblib
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
from river import anomaly, preprocessing, ensemble, tree, metrics, drift

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("anomaly_detection.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Paths for storing models
MODEL_DIR = "models"
LOGIN_RF_MODEL_PATH = os.path.join(MODEL_DIR, "login_rf_model.pkl")
LOGIN_XGB_MODEL_PATH = os.path.join(MODEL_DIR, "login_xgb_model.pkl")
LOGIN_SCALER_PATH = os.path.join(MODEL_DIR, "login_scaler.pkl")
TRANSACTION_RF_MODEL_PATH = os.path.join(MODEL_DIR, "transaction_rf_model.pkl")
TRANSACTION_XGB_MODEL_PATH = os.path.join(MODEL_DIR, "transaction_xgb_model.pkl")
TRANSACTION_SCALER_PATH = os.path.join(MODEL_DIR, "transaction_scaler.pkl")
ONLINE_LOGIN_MODEL_PATH = os.path.join(MODEL_DIR, "online_login_model.pkl")
ONLINE_TRANSACTION_MODEL_PATH = os.path.join(MODEL_DIR, "online_transaction_model.pkl")

# Create models directory if it doesn't exist
os.makedirs(MODEL_DIR, exist_ok=True)

class AnomalyDetectionModel:
    """Base class for anomaly detection models"""
    
    def __init__(self, model_type: str):
        self.model_type = model_type
        self.rf_model_path = LOGIN_RF_MODEL_PATH if model_type == "login" else TRANSACTION_RF_MODEL_PATH
        self.xgb_model_path = LOGIN_XGB_MODEL_PATH if model_type == "login" else TRANSACTION_XGB_MODEL_PATH
        self.scaler_path = LOGIN_SCALER_PATH if model_type == "login" else TRANSACTION_SCALER_PATH
        self.online_model_path = ONLINE_LOGIN_MODEL_PATH if model_type == "login" else ONLINE_TRANSACTION_MODEL_PATH
        
        # Load or train models
        self.rf_model, self.xgb_model, self.scaler = self._load_or_train_models()
        self.online_model = self._load_or_create_online_model()
        
    def _train_initial_models(self):
        """Train initial models if they don't exist"""
        try:
            logger.info(f"Training initial {self.model_type} models")
            
            # Create synthetic data for initial training
            n_samples = 1000
            
            # Generate normal behavior data (80% of samples)
            normal_samples = int(n_samples * 0.8)
            anomaly_samples = n_samples - normal_samples
            
            if self.model_type == "login":
                # Features for login: typing_speed, cursor_movements, session_duration, hour, latitude, longitude, keystroke_variance
                normal_data = np.random.rand(normal_samples, 7)
                # Normalize to realistic ranges
                normal_data[:, 0] *= 10  # typing_speed: 0-10 chars/sec
                normal_data[:, 1] *= 100  # cursor_movements: 0-100 movements
                normal_data[:, 2] = normal_data[:, 2] * 120 + 30  # session_duration: 30-150 seconds
                normal_data[:, 3] = np.random.randint(8, 20, size=normal_samples)  # hour: 8am-8pm
                normal_data[:, 4] = np.random.uniform(10, 40, size=normal_samples)  # latitude: 10-40
                normal_data[:, 5] = np.random.uniform(70, 100, size=normal_samples)  # longitude: 70-100
                normal_data[:, 6] = np.random.uniform(0.01, 0.2, size=normal_samples)  # keystroke_variance: 0.01-0.2 seconds
                
                # Generate anomaly data (20% of samples)
                anomaly_data = np.random.rand(anomaly_samples, 7)
                # Make anomalies more extreme
                anomaly_data[:, 0] = np.random.choice([0.5, 15], size=anomaly_samples)  # very slow or very fast typing
                anomaly_data[:, 1] = np.random.choice([5, 200], size=anomaly_samples)  # very few or many cursor movements
                anomaly_data[:, 2] = np.random.choice([10, 300], size=anomaly_samples)  # very short or long sessions
                anomaly_data[:, 3] = np.random.choice([1, 3, 23], size=anomaly_samples)  # unusual hours (night)
                anomaly_data[:, 4] = np.random.uniform(-90, 90, size=anomaly_samples)  # random latitudes
                anomaly_data[:, 5] = np.random.uniform(-180, 180, size=anomaly_samples)  # random longitudes
                anomaly_data[:, 6] = np.random.uniform(0.5, 2.0, size=anomaly_samples)  # high keystroke variance
            else:
                # Features for transaction: transaction_amount, from_balance, amount_ratio, transaction_frequency, 
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
            joblib.dump(rf_model, self.rf_model_path)
            joblib.dump(xgb_model, self.xgb_model_path)
            joblib.dump(scaler, self.scaler_path)
            
            logger.info(f"Initial {self.model_type} models trained and saved successfully")
            
            return rf_model, xgb_model, scaler
        
        except Exception as e:
            logger.error(f"Error training initial {self.model_type} models: {str(e)}", exc_info=True)
            raise
    
    def _load_or_train_models(self):
        """Load existing models or train new ones if they don't exist"""
        try:
            if (os.path.exists(self.rf_model_path) and 
                os.path.exists(self.xgb_model_path) and 
                os.path.exists(self.scaler_path)):
                
                logger.info(f"Loading existing {self.model_type} models")
                rf_model = joblib.load(self.rf_model_path)
                xgb_model = joblib.load(self.xgb_model_path)
                scaler = joblib.load(self.scaler_path)
            else:
                logger.info(f"Training new {self.model_type} models")
                rf_model, xgb_model, scaler = self._train_initial_models()
                
            return rf_model, xgb_model, scaler
        
        except Exception as e:
            logger.error(f"Error loading {self.model_type} models: {str(e)}", exc_info=True)
            # Train new models as fallback
            logger.info(f"Training new {self.model_type} models as fallback")
            return self._train_initial_models()
    
    def _load_or_create_online_model(self):
        """Load or create online learning model"""
        try:
            # Check if River is available
            try:
                from river import anomaly, preprocessing, ensemble
                river_available = True
            except ImportError:
                logger.warning("River package not available. Online learning disabled.")
                return None
            
            if os.path.exists(self.online_model_path):
                logger.info(f"Loading existing online {self.model_type} model")
                with open(self.online_model_path, 'rb') as f:
                    return pickle.load(f)
            
            logger.info(f"Creating new online {self.model_type} model")
            
            if self.model_type == "login":
                # For login anomaly detection
                return preprocessing.StandardScaler() | anomaly.HalfSpaceTrees(
                    n_trees=50,
                    height=10,
                    window_size=256,
                    seed=42
                )
            else:
                # For transaction anomaly detection
                return preprocessing.StandardScaler() | ensemble.AdaptiveRandomForestClassifier(
                    n_models=10,
                    seed=42
                )
        
        except Exception as e:
            logger.error(f"Error creating online {self.model_type} model: {str(e)}", exc_info=True)
            return None
    
    def _save_online_model(self):
        """Save online model to disk"""
        if self.online_model is None:
            return
            
        try:
            logger.info(f"Saving online {self.model_type} model")
            with open(self.online_model_path, 'wb') as f:
                pickle.dump(self.online_model, f)
        except Exception as e:
            logger.error(f"Error saving online {self.model_type} model: {str(e)}", exc_info=True)
    
    def _prepare_features(self, features: Dict[str, Any]) -> np.ndarray:
        """Prepare features for the model"""
        if self.model_type == "login":
            # Extract login features
            typing_speed = features.get('typing_speed', 0) or 0
            cursor_movements = features.get('cursor_movements', 0) or 0
            session_duration = features.get('session_duration', 0) or 0
            latitude = features.get('latitude', 0) or 0
            longitude = features.get('longitude', 0) or 0
            
            # Calculate keystroke variance if available
            keystroke_variance = 0.0
            keystroke_timings = features.get('keystroke_timings', [])
            if keystroke_timings and len(keystroke_timings) > 1:
                keystroke_variance = np.var(keystroke_timings)
            
            # Parse timestamp to get hour
            timestamp = features.get('timestamp')
            try:
                hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
            except:
                hour = datetime.now().hour
            
            # Return features array
            return np.array([
                typing_speed,
                cursor_movements,
                session_duration,
                hour,
                latitude,
                longitude,
                keystroke_variance
            ]).reshape(1, -1)
        else:
            # Extract transaction features
            transaction_amount = features.get('transaction_amount', 0) or 0
            from_balance = features.get('from_balance', 0) or 0
            transaction_frequency = features.get('transaction_frequency', 0) or 0
            session_duration = features.get('session_duration', 0) or 0
            cursor_movements = features.get('cursor_movements', 0) or 0
            latitude = features.get('latitude', 0) or 0
            longitude = features.get('longitude', 0) or 0
            
            # Calculate amount ratio
            amount_ratio = transaction_amount / from_balance if from_balance > 0 else 0
            
            # Parse timestamp to get hour
            timestamp = features.get('timestamp')
            try:
                hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
            except:
                hour = datetime.now().hour
            
            # Return features array
            return np.array([
                transaction_amount,
                from_balance,
                amount_ratio,
                transaction_frequency,
                session_duration,
                hour,
                latitude,
                longitude,
                cursor_movements
            ]).reshape(1, -1)
    
    def _prepare_online_features(self, features: Dict[str, Any]) -> Dict[str, float]:
        """Prepare features for online model"""
        if self.model_type == "login":
            # Extract login features
            typing_speed = features.get('typing_speed', 0) or 0
            cursor_movements = features.get('cursor_movements', 0) or 0
            session_duration = features.get('session_duration', 0) or 0
            latitude = features.get('latitude', 0) or 0
            longitude = features.get('longitude', 0) or 0
            
            # Calculate keystroke variance if available
            keystroke_variance = 0.0
            keystroke_timings = features.get('keystroke_timings', [])
            if keystroke_timings and len(keystroke_timings) > 1:
                keystroke_variance = np.var(keystroke_timings)
            
            # Parse timestamp to get hour
            timestamp = features.get('timestamp')
            try:
                hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
            except:
                hour = datetime.now().hour
            
            # Return features dict
            return {
                'typing_speed': typing_speed,
                'cursor_movements': cursor_movements,
                'session_duration': session_duration,
                'hour': hour,
                'latitude': latitude,
                'longitude': longitude,
                'keystroke_variance': keystroke_variance
            }
        else:
            # Extract transaction features
            transaction_amount = features.get('transaction_amount', 0) or 0
            from_balance = features.get('from_balance', 0) or 0
            transaction_frequency = features.get('transaction_frequency', 0) or 0
            session_duration = features.get('session_duration', 0) or 0
            cursor_movements = features.get('cursor_movements', 0) or 0
            latitude = features.get('latitude', 0) or 0
            longitude = features.get('longitude', 0) or 0
            
            # Calculate amount ratio
            amount_ratio = transaction_amount / from_balance if from_balance > 0 else 0
            
            # Parse timestamp to get hour
            timestamp = features.get('timestamp')
            try:
                hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
            except:
                hour = datetime.now().hour
            
            # Return features dict
            return {
                'transaction_amount': transaction_amount,
                'from_balance': from_balance,
                'amount_ratio': amount_ratio,
                'transaction_frequency': transaction_frequency,
                'session_duration': session_duration,
                'hour': hour,
                'latitude': latitude,
                'longitude': longitude,
                'cursor_movements': cursor_movements
            }
    
    def _determine_anomaly_type(self, features: Dict[str, Any], is_anomaly: bool) -> str:
        """Determine the type of anomaly based on feature analysis"""
        if not is_anomaly:
            return None
        
        if self.model_type == "login":
            typing_speed = features.get('typing_speed', 0) or 0
            session_duration = features.get('session_duration', 0) or 0
            keystroke_timings = features.get('keystroke_timings', [])
            keystroke_variance = np.var(keystroke_timings) if keystroke_timings and len(keystroke_timings) > 1 else 0
            
            timestamp = features.get('timestamp')
            try:
                hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
            except:
                hour = datetime.now().hour
            
            # Analyze which features contributed most to the anomaly
            if typing_speed < 1 or typing_speed > 12:
                return "Unusual typing pattern"
            elif session_duration < 10:
                return "Unusually quick login"
            elif hour >= 0 and hour <= 5:
                return "Unusual login time (night)"
            elif keystroke_variance > 0.5:
                return "Inconsistent typing rhythm"
            else:
                return "Suspicious login behavior"
        else:
            transaction_amount = features.get('transaction_amount', 0) or 0
            from_balance = features.get('from_balance', 0) or 0
            amount_ratio = transaction_amount / from_balance if from_balance > 0 else 0
            session_duration = features.get('session_duration', 0) or 0
            
            timestamp = features.get('timestamp')
            try:
                hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
            except:
                hour = datetime.now().hour
            
            # Analyze which features contributed most to the anomaly
            if amount_ratio > 0.7:
                return "Unusually large transaction relative to balance"
            elif transaction_amount > 10000:
                return "Unusually large transaction amount!! \nAnomaly logged and staff alert created"
            elif session_duration < 10:
                return "Unusually quick transaction"
            elif hour >= 0 and hour <= 5:
                return "Unusual transaction time (night)"
            else:
                return "Suspicious transaction pattern"
    
    def detect_anomaly(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detect anomalies using both static and online models
        Returns: dict with is_anomalous, anomaly_type, and score
        """
        try:
            logger.info(f"Starting {self.model_type} anomaly detection with features: {features}")
            
            # Prepare features for static models
            model_features = self._prepare_features(features)
            
            # Scale features
            scaled_features = self.scaler.transform(model_features)
            
            # Make predictions with both models
            rf_pred = self.rf_model.predict(scaled_features)[0]
            rf_prob = self.rf_model.predict_proba(scaled_features)[0][1]
            
            xgb_pred = self.xgb_model.predict(scaled_features)[0]
            xgb_prob = self.xgb_model.predict_proba(scaled_features)[0][1]
            
            # Ensemble prediction (weighted average)
            ensemble_prob = 0.6 * rf_prob + 0.4 * xgb_prob
            ensemble_pred = 1 if ensemble_prob > 0.7 else 0
            
            logger.info(f"Static model predictions - RF: {rf_pred} ({rf_prob:.3f}), XGB: {xgb_pred} ({xgb_prob:.3f}), Ensemble: {ensemble_pred} ({ensemble_prob:.3f})")
            
            # Use online model if available
            online_pred = 0
            online_prob = 0.0
            
            if self.online_model is not None:
                try:
                    # Prepare features for online model
                    online_features = self._prepare_online_features(features)
                    
                    # Make prediction with online model
                    if self.model_type == "login":
                        # For anomaly detection models
                        online_prob = self.online_model.score_one(online_features)
                        online_pred = 1 if online_prob > 0.7 else 0
                    else:
                        # For classification models
                        pred_proba = self.online_model.predict_proba_one(online_features)
                        online_prob = pred_proba.get(1, 0.0)
                        online_pred = 1 if online_prob > 0.7 else 0
                    
                    logger.info(f"Online model prediction: {online_pred} ({online_prob:.3f})")
                    
                    # Update online model with this data point
                    # In a real system, you would want to confirm if this was actually an anomaly
                    if self.model_type == "login":
                        # For anomaly detection models
                        self.online_model.learn_one(online_features)
                    else:
                        # For classification models
                        self.online_model.learn_one(online_features, ensemble_pred)
                    
                    # Save updated model
                    self._save_online_model()
                    
                    # Combine predictions from static and online models
                    ensemble_prob = (0.7 * ensemble_prob + 0.3 * online_prob)
                    ensemble_pred = 1 if ensemble_prob > 0.7 else 0
                except Exception as e:
                    logger.error(f"Error using online model: {str(e)}", exc_info=True)
            
            # Determine anomaly type
            anomaly_type = self._determine_anomaly_type(features, ensemble_pred == 1)
            
            result = {
                "is_anomalous": bool(ensemble_pred == 1),
                "anomaly_type": anomaly_type,
                "score": float(ensemble_prob)
            }
            
            logger.info(f"{self.model_type.capitalize()} anomaly detection result: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error in {self.model_type} anomaly detection: {str(e)}", exc_info=True)
            
            # Fall back to a simple heuristic approach
            if self.model_type == "login":
                return self._login_fallback_detection(features)
            else:
                return self._transaction_fallback_detection(features)
    
    def _login_fallback_detection(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback login anomaly detection using simple heuristics"""
        anomaly_score = 0.0
        anomaly_type = None
        
        # Extract features
        typing_speed = features.get('typing_speed', 0) or 0
        session_duration = features.get('session_duration', 0) or 0
        
        # Parse timestamp to get hour
        timestamp = features.get('timestamp')
        try:
            hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
        except:
            hour = datetime.now().hour
        
        # Check typing speed (if unusually slow or fast)
        if typing_speed < 1 or typing_speed > 12:
            anomaly_score += 0.3
            anomaly_type = "Unusual typing pattern"
        
        # Check session duration (if too quick)
        if session_duration < 10:
            anomaly_score += 0.4
            anomaly_type = anomaly_type or "Unusually quick login"
        
        # Check login time (if unusual)
        if hour >= 0 and hour <= 5:
            anomaly_score += 0.3
            anomaly_type = anomaly_type or "Unusual login time (night)"
        
        # Determine if this is an anomaly
        is_anomalous = anomaly_score >= 0.7
        
        result = {
            "is_anomalous": is_anomalous,
            "anomaly_type": anomaly_type if is_anomalous else None,
            "score": anomaly_score
        }
        
        logger.info(f"Fallback login anomaly detection result: {result}")
        return result
    
    def _transaction_fallback_detection(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback transaction anomaly detection using simple heuristics"""
        anomaly_score = 0.0
        anomaly_type = None
        
        # Extract features
        transaction_amount = features.get('transaction_amount', 0) or 0
        from_balance = features.get('from_balance', 0) or 0
        amount_ratio = transaction_amount / from_balance if from_balance > 0 else 0
        session_duration = features.get('session_duration', 0) or 0
        
        # Parse timestamp to get hour
        timestamp = features.get('timestamp')
        try:
            hour = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).hour
        except:
            hour = datetime.now().hour
        
        # Check transaction amount (if unusually large)
        if transaction_amount > 10000:
            anomaly_score += 0.3
            anomaly_type = "Unusually large transaction"
        
        # Check amount ratio (if high percentage of balance)
        if amount_ratio > 0.7:
            anomaly_score += 0.4
            anomaly_type = anomaly_type or "High percentage of available balance"
        
        # Check session duration (if too quick)
        if session_duration < 10:
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

# Main function to detect anomalies
def detect_anomaly(features: Dict[str, Any], model_type: str) -> Dict[str, Any]:
    """
    Detect anomalies using the appropriate model
    Args:
        features: Dict of features
        model_type: "login" or "transaction"
    Returns:
        Dict with is_anomalous, anomaly_type, and score
    """
    model = AnomalyDetectionModel(model_type)
    return model.detect_anomaly(features)

# Entry point for command line execution
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments. Usage: python anomaly_detection_model.py <model_type> <features_json>"}))
        sys.exit(1)
    
    model_type = sys.argv[1]  # "login" or "transaction"
    features_json = sys.argv[2]
    features = json.loads(features_json)
    
    # Detect anomalies
    result = detect_anomaly(features, model_type)
    
    # Output result as JSON
    print(json.dumps(result))
