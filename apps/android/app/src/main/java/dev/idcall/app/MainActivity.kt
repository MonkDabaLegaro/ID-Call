package dev.idcall.app

import android.app.role.RoleManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    private val roleLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                HomeScreen(onEnableCallerId = ::requestCallScreeningRole)
            }
        }
    }

    private fun requestCallScreeningRole() {
        val roleManager = getSystemService(RoleManager::class.java)
        if (roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) &&
            !roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
        ) {
            val intent: Intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
            roleLauncher.launch(intent)
        }
    }
}

@Composable
private fun HomeScreen(onEnableCallerId: () -> Unit) {
    Column(modifier = Modifier.padding(24.dp)) {
        Text("ID-Call", style = MaterialTheme.typography.headlineLarge)
        Text("Caller intelligence with source-aware number metadata and reputation.")
        Button(onClick = onEnableCallerId, modifier = Modifier.padding(top = 16.dp)) {
            Text("Enable caller identification")
        }
    }
}
