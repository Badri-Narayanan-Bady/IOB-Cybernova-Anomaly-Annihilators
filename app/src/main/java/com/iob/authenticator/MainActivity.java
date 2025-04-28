package com.iob.authenticator;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.floatingactionbutton.FloatingActionButton;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Timer;
import java.util.TimerTask;

public class MainActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_REQUEST_CODE = 100;
    private TextView welcomeTextView;
    private TextView instructionsTextView;
    private Button scanQrButton;
    private FloatingActionButton refreshButton;
    private TextView totpCodeTextView;
    private ProgressBar totpProgressBar;
    private TextView timerTextView;
    private View totpContainer;
    private TextView accountInfoTextView;

    private TOTPGenerator totpGenerator;
    private Timer timer;
    private Handler handler;
    private int timeRemaining = 30;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize views
        welcomeTextView = findViewById(R.id.welcomeTextView);
        instructionsTextView = findViewById(R.id.instructionsTextView);
        scanQrButton = findViewById(R.id.scanQrButton);
        refreshButton = findViewById(R.id.refreshButton);
        totpCodeTextView = findViewById(R.id.totpCodeTextView);
        totpProgressBar = findViewById(R.id.totpProgressBar);
        timerTextView = findViewById(R.id.timerTextView);
        totpContainer = findViewById(R.id.totpContainer);
        accountInfoTextView = findViewById(R.id.accountInfoTextView);

        // Initialize TOTP generator
        totpGenerator = new TOTPGenerator();
        handler = new Handler(Looper.getMainLooper());

        // Check if user has already set up TOTP
        SharedPreferences prefs = getSharedPreferences("IOBAuthenticator", MODE_PRIVATE);
        String secret = prefs.getString("totp_secret", null);
        String userId = prefs.getString("user_id", null);
        String accountId = prefs.getString("account_id", null);
        String userName = prefs.getString("user_name", null);

        if (secret != null && userId != null) {
            // User has already set up TOTP
            showTOTPView();
            updateAccountInfo(userName, accountId);
        } else {
            // User needs to set up TOTP
            showScanView();
        }

        // Set up click listeners
        scanQrButton.setOnClickListener(v -> {
            if (checkCameraPermission()) {
                startQRScanner();
            } else {
                requestCameraPermission();
            }
        });

        refreshButton.setOnClickListener(v -> {
            generateAndDisplayTOTP();
        });
    }

    private void showScanView() {
        welcomeTextView.setVisibility(View.VISIBLE);
        instructionsTextView.setVisibility(View.VISIBLE);
        scanQrButton.setVisibility(View.VISIBLE);
        totpContainer.setVisibility(View.GONE);
        accountInfoTextView.setVisibility(View.GONE);
    }

    private void showTOTPView() {
        welcomeTextView.setVisibility(View.GONE);
        instructionsTextView.setVisibility(View.GONE);
        scanQrButton.setVisibility(View.GONE);
        totpContainer.setVisibility(View.VISIBLE);
        accountInfoTextView.setVisibility(View.VISIBLE);
        
        // Start generating TOTP
        generateAndDisplayTOTP();
        startTOTPTimer();
    }

    private void updateAccountInfo(String userName, String accountId) {
        if (userName != null && accountId != null) {
            accountInfoTextView.setText(String.format("Account: %s\nAccount ID: %s", userName, accountId));
        }
    }

    private void generateAndDisplayTOTP() {
        SharedPreferences prefs = getSharedPreferences("IOBAuthenticator", MODE_PRIVATE);
        String secret = prefs.getString("totp_secret", null);
        
        if (secret != null) {
            String code = totpGenerator.generateTOTP(secret);
            totpCodeTextView.setText(code);
        }
    }

    private void startTOTPTimer() {
        if (timer != null) {
            timer.cancel();
        }
        
        timer = new Timer();
        timeRemaining = 30 - (int)(System.currentTimeMillis() / 1000 % 30);
        
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                timeRemaining = 30 - (int)(System.currentTimeMillis() / 1000 % 30);
                
                handler.post(() -> {
                    timerTextView.setText(String.format("%d seconds", timeRemaining));
                    totpProgressBar.setProgress(timeRemaining * 100 / 30);
                    
                    if (timeRemaining == 30) {
                        // Generate new TOTP when timer resets
                        generateAndDisplayTOTP();
                    }
                });
            }
        }, 0, 1000);
    }

    private boolean checkCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestCameraPermission() {
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST_CODE);
    }

    private void startQRScanner() {
        IntentIntegrator integrator = new IntentIntegrator(this);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
        integrator.setPrompt("Scan QR code from IOB Banking website");
        integrator.setCameraId(0);
        integrator.setBeepEnabled(true);
        integrator.setBarcodeImageEnabled(true);
        integrator.initiateScan();
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
            // Check if QR code is in the expected format
            if (qrContent.startsWith("iob-auth://")) {
                String encodedData = qrContent.substring(10); // Remove "iob-auth://"
                String decodedData = new String(android.util.Base64.decode(encodedData, android.util.Base64.DEFAULT));
                
                JSONObject jsonData = new JSONObject(decodedData);
                String userId = jsonData.getString("userId");
                String accountId = jsonData.getString("accountId");
                String userName = jsonData.getString("userName");
                String timestamp = jsonData.getString("timestamp");
                String type = jsonData.getString("type");
                
                if ("auth".equals(type)) {
                    // Generate a new TOTP secret
                    String secret = totpGenerator.generateSecret();
                    
                    // Save the secret and user info
                    SharedPreferences prefs = getSharedPreferences("IOBAuthenticator", MODE_PRIVATE);
                    SharedPreferences.Editor editor = prefs.edit();
                    editor.putString("totp_secret", secret);
                    editor.putString("user_id", userId);
                    editor.putString("account_id", accountId);
                    editor.putString("user_name", userName);
                    editor.apply();
                    
                    // Send the secret to the server
                    // In a real app, this would be done securely
                    // For demo purposes, we'll just show a success message
                    Toast.makeText(this, "TOTP setup successful", Toast.LENGTH_SHORT).show();
                    
                    // Show the TOTP view
                    showTOTPView();
                    updateAccountInfo(userName, accountId);
                }
            } else {
                Toast.makeText(this, "Invalid QR code format", Toast.LENGTH_SHORT).show();
            }
        } catch (JSONException e) {
            Toast.makeText(this, "Error processing QR code: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (timer != null) {
            timer.cancel();
        }
    }
}
