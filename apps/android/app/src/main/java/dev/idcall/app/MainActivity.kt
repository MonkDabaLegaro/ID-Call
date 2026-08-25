package dev.idcall.app

import android.app.role.RoleManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.lifecycle.ViewModelProvider
import dev.idcall.core.data.LookupRepositoryFactory
import dev.idcall.feature.lookup.LookupScreen
import dev.idcall.feature.lookup.LookupViewModel
import dev.idcall.feature.lookup.LookupViewModelFactory

class MainActivity : ComponentActivity() {
    private val roleLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val repository = LookupRepositoryFactory.create(this)
        val lookupViewModel = ViewModelProvider(
            this,
            LookupViewModelFactory(repository),
        )[LookupViewModel::class.java]

        setContent {
            MaterialTheme {
                LookupScreen(
                    viewModel = lookupViewModel,
                    onEnableCallerId = ::requestCallScreeningRole,
                )
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
