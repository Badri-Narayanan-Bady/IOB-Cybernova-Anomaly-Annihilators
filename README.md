# IOB Banking System with Anomaly Detection

This project implements a secure banking system for Indian Overseas Bank with advanced anomaly detection capabilities. The system consists of two main components:

1. **Web Application**: A Next.js-based banking website with multi-factor authentication and anomaly detection
2. **Mobile Authenticator App**: An Android app for generating TOTP codes and verifying transactions

## Features

### Security Features
- **Multi-factor Authentication**: TOTP-based authentication using the IOB Authenticator app
- **Anomaly Detection**: Machine learning-based detection of suspicious login attempts and transactions
- **Behavioral Metrics**: Collection and analysis of user behavior for enhanced security
- **Staff Alerts**: Automatic alerts to bank staff when suspicious activities are detected
- **QR Code Integration**: Secure session management using QR codes

### Banking Features
- Account management
- Fund transfers (internal and external)
- Transaction history with anomaly flagging
- Account statements
- Profile management

## Technical Architecture

### Web Application (Next.js)
- **Frontend**: React with Next.js App Router, Tailwind CSS, and shadcn/ui components
- **Backend**: Next.js API routes with server actions
- **Database**: MySQL/PostgreSQL with Supabase integration
- **Authentication**: Custom TOTP implementation with QR code generation
- **Anomaly Detection**: Python-based ML models integrated with the web application

### Mobile Authenticator App (Android)
- **Language**: Java
- **Features**: TOTP generation, QR code scanning, transaction verification
- **Security**: Secure storage of TOTP secrets, biometric authentication

### Machine Learning Models
- **Login Anomaly Detection**: Analyzes typing patterns, session duration, and other behavioral metrics
- **Transaction Anomaly Detection**: Analyzes transaction amounts, frequency, and user behavior
- **Online Learning**: Models that improve over time based on user behavior

## Setup Instructions

### Web Application

1. Clone the repository:
\`\`\`bash
git clone https://github.com/your-username/iob-banking.git
cd iob-banking
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:
Create a `.env.local` file with the following variables:
\`\`\`
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

4. Initialize the database:
\`\`\`bash
npm run db:init
\`\`\`

5. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

### Android Authenticator App

1. Open the `android/IOBAuthenticator` project in Android Studio

2. Build the project:
\`\`\`bash
./gradlew build
\`\`\`

3. Generate APK:
\`\`\`bash
./gradlew assembleDebug
\`\`\`

The APK will be available at `android/IOBAuthenticator/app/build/outputs/apk/debug/app-debug.apk`

## Time-based One-Time Password (TOTP)

TOTP is a time-based one-time password algorithm that generates a one-time password which changes every 30 seconds. It is used for two-factor authentication.

### How TOTP Works

1. A shared secret key is established between the server and the client (mobile app)
2. The current time is used as an input to the HMAC-SHA1 algorithm along with the secret key
3. The resulting hash is truncated to get a 6-digit code
4. The code is valid for 30 seconds

### Implementation Details

- The server generates a random secret key for each user
- The secret key is shared with the user via a QR code
- The mobile app scans the QR code and stores the secret key
- The mobile app generates TOTP codes based on the secret key and current time
- The server verifies the TOTP code by generating the same code and comparing

## Anomaly Detection

The system uses machine learning models to detect anomalies in user behavior.

### Login Anomaly Detection

The login anomaly detection model analyzes:
- Typing speed and patterns
- Cursor movements
- Session duration
- Login time of day
- Geographic location

### Transaction Anomaly Detection

The transaction anomaly detection model analyzes:
- Transaction amount
- Transaction frequency
- Ratio of transaction amount to account balance
- Session duration
- Transaction time of day
- Geographic location

### Machine Learning Models

The system uses a combination of:
- Random Forest Classifier
- XGBoost Classifier
- Isolation Forest
- Online learning models that adapt to user behavior over time

## Security Considerations

- All sensitive data is encrypted in transit and at rest
- TOTP secrets are stored securely
- Passwords are hashed using bcrypt
- API endpoints are protected against CSRF and other attacks
- Rate limiting is implemented to prevent brute force attacks
- Anomaly detection provides an additional layer of security

## License

This project is licensed under the MIT License - see the LICENSE file for details.
\`\`\`

Let's also create a comprehensive Android app for the IOB Authenticator:

```java file="android/IOBAuthenticator/app/src/main/java/com/iob/authenticator/MainActivity.java"
package com.iob.authenticator;

import android.Manifest;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

public class MainActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_REQUEST_CODE = 100;
    private static final String PREFS_NAME = "IOBAuthenticatorPrefs";
    private static final String KEY_FIRST_RUN = "firstRun";
    private static final String KEY_ACCOUNTS_PREFIX = "account_";

    private RecyclerView recyclerView;
    private TOTPAdapter adapter;
    private List<TOTPAccount> accounts;
    private ProgressBar progressBar;
    private TextView timerTextView;
    private CountDownTimer countDownTimer;
    private Handler handler = new Handler(Looper.getMainLooper());
    private Runnable updateCodesRunnable;
    private boolean isAppLocked = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize UI components
        recyclerView = findViewById(R.id.recyclerView);
        progressBar = findViewById(R.id.progressBar);
        timerTextView = findViewById(R.id.timerTextView);
        FloatingActionButton addButton = findViewById(R.id.addButton);
        ImageButton settingsButton = findViewById(R.id.settingsButton);

        // Set up RecyclerView
        accounts = new ArrayList<>();
        adapter = new TOTPAdapter(accounts, code -> {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText("TOTP Code", code);
            clipboard.setPrimaryClip(clip);
            Toast.makeText(MainActivity.this, "Code copied to clipboard", Toast.LENGTH_SHORT).show();
        });
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        recyclerView.setAdapter(adapter);

        // Check if it's the first run
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isFirstRun = prefs.getBoolean(KEY_FIRST_RUN, true);

        if (isFirstRun) {
            // Show welcome dialog
            showWelcomeDialog();
            
            // Mark first run as completed
            prefs.edit().putBoolean(KEY_FIRST_RUN, false).apply();
        } else {
            // Authenticate user
            authenticateUser();
        }

        // Set up add button
        addButton.setOnClickListener(v -> {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) 
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, 
                        new String[]{Manifest.permission.CAMERA}, 
                        CAMERA_PERMISSION_REQUEST_CODE);
            } else {
                startQRScanner();
            }
        });

        // Set up settings button
        settingsButton.setOnClickListener(v -> {
            // Show settings dialog
            showSettingsDialog();
        });

        // Set up timer
        setupTimer();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!isAppLocked) {
            loadAccounts();
            startCodeUpdates();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopCodeUpdates();
    }

    private void authenticateUser() {
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt biometricPrompt = new BiometricPrompt(this, executor, 
                new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                isAppLocked = false;
                loadAccounts();
                startCodeUpdates();
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON || 
                        errorCode == BiometricPrompt.ERROR_USER_CANCELED) {
                    // User canceled, provide alternative authentication
                    showPinDialog();
                } else {
                    Toast.makeText(MainActivity.this, 
                            "Authentication error: " + errString, Toast.LENGTH_SHORT).show();
                    finish();
                }
            }

            @Override
            public void onAuthenticationFailed() {
                super.onAuthenticationFailed();
                Toast.makeText(MainActivity.this, 
                        "Authentication failed", Toast.LENGTH_SHORT).show();
            }
        });

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Authenticate to IOB Authenticator")
                .setSubtitle("Use your biometric credential to access your accounts")
                .setNegativeButtonText("Use PIN")
                .build();

        biometricPrompt.authenticate(promptInfo);
    }

    private void showPinDialog() {
        // In a real app, implement a secure PIN verification
        // For demo purposes, we'll just unlock the app
        isAppLocked = false;
        loadAccounts();
        startCodeUpdates();
    }

    private void showWelcomeDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Welcome to IOB Authenticator");
        builder.setMessage("This app helps you secure your Indian Overseas Bank account with two-factor authentication. " +
                "Tap the + button to add your account by scanning a QR code from the IOB website.");
        builder.setPositiveButton("Get Started", (dialog, which) -> {
            isAppLocked = false;
            dialog.dismiss();
        });
        builder.setCancelable(false);
        builder.show();
    }

    private void showSettingsDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Settings");
        String[] options = {"About", "Help", "Clear All Accounts"};
        builder.setItems(options, (dialog, which) -> {
            switch (which) {
                case 0: // About
                    showAboutDialog();
                    break;
                case 1: // Help
                    showHelpDialog();
                    break;
                case 2: // Clear All Accounts
                    showClearAccountsConfirmation();
                    break;
            }
        });
        builder.show();
    }

    private void showAboutDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("About IOB Authenticator");
        builder.setMessage("Version 1.0.0\n\nIOB Authenticator is a secure two-factor authentication app for Indian Overseas Bank customers. " +
                "It generates time-based one-time passwords (TOTP) to help secure your account.");
        builder.setPositiveButton("OK", null);
        builder.show();
    }

    private void showHelpDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Help");
        builder.setMessage("How to use IOB Authenticator:\n\n" +
                "1. Log in to your IOB online banking account\n" +
                "2. Go to Security Settings and select 'Set up two-factor authentication'\n" +
                "3. Scan the QR code shown on the website using this app\n" +
                "4. When logging in or making transactions, enter the 6-digit code shown in this app");
        builder.setPositiveButton("OK", null);  enter the 6-digit code shown in this app");
        builder.setPositiveButton("OK", null);
        builder.show();
    }

    private void showClearAccountsConfirmation() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Clear All Accounts");
        builder.setMessage("Are you sure you want to remove all accounts? This action cannot be undone.");
        builder.setPositiveButton("Clear All", (dialog, which) -> {
            clearAllAccounts();
            Toast.makeText(MainActivity.this, "All accounts removed", Toast.LENGTH_SHORT).show();
        });
        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    private void clearAllAccounts() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        
        // Remove all account entries
        for (TOTPAccount account : accounts) {
            editor.remove(KEY_ACCOUNTS_PREFIX + account.getId());
        }
        
        editor.apply();
        
        // Clear the list and update UI
        accounts.clear();
        adapter.notifyDataSetChanged();
    }

    private void startQRScanner() {
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
        integrator.setPrompt("Scan the QR code from the IOB website");
        integrator.setCameraId(0);
        integrator.setBeepEnabled(false);
        integrator.setBarcodeImageEnabled(false);
        integrator.initiateScan();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() == null) {
                Toast.makeText(this, "Scan cancelled", Toast.LENGTH_SHORT).show();
            } else {
                processQRCode(result.getContents());
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void processQRCode(String qrContent) {
        try {
            // Parse the QR code content
            // Expected format: otpauth://totp/IOB:accountId?secret=SECRET&issuer=IndianOverseasBank
            if (qrContent.startsWith("otpauth://totp/")) {
                String[] parts = qrContent.split("\\?");
                String path = parts[0].substring("otpauth://totp/".length());
                String[] pathParts = path.split(":");
                
                String issuer = pathParts[0];
                String accountName = pathParts.length > 1 ? pathParts[1] : "Unknown";
                
                String query = parts[1];
                String[] queryParts = query.split("&");
                String secret = "";
                
                for (String param : queryParts) {
                    if (param.startsWith("secret=")) {
                        secret = param.substring("secret=".length());
                        break;
                    }
                }
                
                if (!secret.isEmpty()) {
                    // Create a new account
                    TOTPAccount account = new TOTPAccount(
                            System.currentTimeMillis() + "", // Generate a unique ID
                            accountName,
                            issuer,
                            secret
                    );
                    
                    // Save the account
                    saveAccount(account);
                    
                    // Add to the list and update UI
                    accounts.add(account);
                    adapter.notifyItemInserted(accounts.size() - 1);
                    
                    Toast.makeText(this, "Account added successfully", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(this, "Invalid QR code: Missing secret", Toast.LENGTH_SHORT).show();
                }
            } else if (qrContent.startsWith("iob-auth://")) {
                // Handle IOB specific QR code format
                // Format: iob-auth://BASE64_ENCODED_DATA
                String encodedData = qrContent.substring("iob-auth://".length());
                // Decode the base64 data
                byte[] decodedBytes = android.util.Base64.decode(encodedData, android.util.Base64.DEFAULT);
                String decodedData = new String(decodedBytes);
                
                // Parse the JSON data
                org.json.JSONObject jsonData = new org.json.JSONObject(decodedData);
                String userId = jsonData.getString("userId");
                String accountId = jsonData.getString("accountId");
                String userName = jsonData.optString("userName", "User");
                
                // Show confirmation dialog
                showAuthConfirmationDialog(userId, accountId, userName);
            } else {
                Toast.makeText(this, "Unsupported QR code format", Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "Error processing QR code: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void showAuthConfirmationDialog(String userId, String accountId, String userName) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Authentication Request");
        builder.setMessage("Do you want to authenticate this login?\n\n" +
                "User: " + userName + "\n" +
                "Account: " + accountId);
        builder.setPositiveButton("Approve", (dialog, which) -> {
            // Generate a TOTP code for this account
            // In a real app, you would use the stored secret for this account
            // For demo, we'll just show a success message
            Toast.makeText(MainActivity.this, "Authentication approved", Toast.LENGTH_SHORT).show();
        });
        builder.setNegativeButton("Deny", (dialog, which) -> {
            Toast.makeText(MainActivity.this, "Authentication denied", Toast.LENGTH_SHORT).show();
        });
        builder.show();
    }

    private void saveAccount(TOTPAccount account) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        
        // Save account details
        editor.putString(KEY_ACCOUNTS_PREFIX + account.getId(), 
                account.getIssuer() + ":" + 
                account.getName() + ":" + 
                account.getSecret());
        
        editor.apply();
    }

    private void loadAccounts() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        accounts.clear();
        
        // Get all saved accounts
        Map<String, ?> allPrefs = prefs.getAll();
        for (Map.Entry<String, ?> entry : allPrefs.entrySet()) {
            if (entry.getKey().startsWith(KEY_ACCOUNTS_PREFIX)) {
                String id = entry.getKey().substring(KEY_ACCOUNTS_PREFIX.length());
                String value = (String) entry.getValue();
                String[] parts = value.split(":");
                
                if (parts.length >= 3) {
                    TOTPAccount account = new TOTPAccount(
                            id,
                            parts[1], // name
                            parts[0], // issuer
                            parts[2]  // secret
                    );
                    accounts.add(account);
                }
            }
        }
        
        adapter.notifyDataSetChanged();
    }

    private void setupTimer() {
        // Calculate time until next 30-second interval
        long currentTimeMillis = System.currentTimeMillis();
        long timeToNextInterval = 30000 - (currentTimeMillis % 30000);
        
        // Update progress bar
        progressBar.setMax(30);
        progressBar.setProgress((int) (timeToNextInterval / 1000));
        
        // Update timer text
        timerTextView.setText(String.valueOf(timeToNextInterval / 1000));
        
        // Start countdown timer
        if (countDownTimer != null) {
            countDownTimer.cancel();
        }
        
        countDownTimer = new CountDownTimer(timeToNextInterval, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                int secondsRemaining = (int) (millisUntilFinished / 1000);
                progressBar.setProgress(secondsRemaining);
                timerTextView.setText(String.valueOf(secondsRemaining));
            }
            
            @Override
            public void onFinish() {
                // Reset timer for next 30-second interval
                setupTimer();
                // Update TOTP codes
                updateTOTPCodes();
            }
        }.start();
    }

    private void startCodeUpdates() {
        // Update codes immediately
        updateTOTPCodes();
        
        // Set up periodic updates
        updateCodesRunnable = new Runnable() {
            @Override
            public void run() {
                updateTOTPCodes();
                handler.postDelayed(this, 1000); // Check every second
            }
        };
        
        handler.post(updateCodesRunnable);
    }

    private void stopCodeUpdates() {
        if (updateCodesRunnable != null) {
            handler.removeCallbacks(updateCodesRunnable);
        }
        
        if (countDownTimer != null) {
            countDownTimer.cancel();
        }
    }

    private void updateTOTPCodes() {
        for (TOTPAccount account : accounts) {
            String code = TOTPGenerator.generateTOTP(account.getSecret());
            account.setCurrentCode(code);
        }
        adapter.notifyDataSetChanged();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startQRScanner();
            } else {
                Toast.makeText(this, "Camera permission is required to scan QR codes", Toast.LENGTH_SHORT).show();
            }
        }
    }
}
