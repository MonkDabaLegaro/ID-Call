package dev.idcall.feature.lookup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.idcall.core.model.LookupHistoryItem
import dev.idcall.core.model.LookupOrigin

private val visibleReportCategories = listOf(
    "spam" to "Spam",
    "scam" to "Scam",
    "telemarketing" to "Telemarketing",
    "robocall" to "Robocall",
    "legitimate_business" to "Legitimate business",
)

@Composable
fun LookupScreen(
    viewModel: LookupViewModel,
    onEnableCallerId: () -> Unit,
) {
    var number by remember { mutableStateOf("") }
    val state by viewModel.state.collectAsState()
    val history by viewModel.history.collectAsState()
    val reportMessage by viewModel.reportMessage.collectAsState()

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("ID-Call", style = MaterialTheme.typography.headlineLarge)
        Text("Caller intelligence with explicit provenance and local-first screening.")

        Button(onClick = onEnableCallerId) {
            Text("Enable caller identification")
        }

        OutlinedTextField(
            value = number,
            onValueChange = { number = it },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Phone number") },
            placeholder = { Text("+56 2 2345 6789") },
        )

        Button(
            onClick = { viewModel.lookup(number) },
            enabled = state !is LookupUiState.Loading,
        ) {
            Text("Look up number")
        }

        RecentHistory(history) { selected ->
            number = selected
            viewModel.lookup(selected)
        }

        when (val current = state) {
            LookupUiState.Idle -> Text("Search a number to inspect its numbering metadata and reputation.")
            LookupUiState.Loading -> Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator()
                Text("Looking up…", modifier = Modifier.padding(start = 12.dp))
            }
            is LookupUiState.Error -> Text(current.message, color = MaterialTheme.colorScheme.error)
            is LookupUiState.Success -> LookupResultCard(current, viewModel::report)
        }

        reportMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun RecentHistory(history: List<LookupHistoryItem>, onSelect: (String) -> Unit) {
    if (history.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Recent lookups", style = MaterialTheme.typography.titleMedium)
        history.forEach { item ->
            TextButton(onClick = { onSelect(item.number) }) {
                Text("${item.displayLabel} · ${item.number} · ${item.reputationLevel}")
            }
        }
    }
}

@Composable
private fun LookupResultCard(state: LookupUiState.Success, onReport: (String) -> Unit) {
    val record = state.result.record
    val originLabel = when (state.result.origin) {
        LookupOrigin.FRESH_CACHE -> "Fresh local cache"
        LookupOrigin.NETWORK -> "Network refresh"
        LookupOrigin.STALE_CACHE -> "Offline stale cache"
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(record.displayLabel, style = MaterialTheme.typography.titleLarge)
            Text(record.number, style = MaterialTheme.typography.bodyMedium)
            Text("Source: $originLabel")

            record.identity?.let { identity ->
                Spacer(Modifier.height(4.dp))
                Text("Business identity", style = MaterialTheme.typography.titleMedium)
                Text("Verification: ${identity.verification}")
                Text("Confidence: ${(identity.confidence * 100).toInt()}%")
                identity.publicWebsite?.let { Text("Website: $it") }
                identity.publicAddress?.let { Text("Public address: $it") }
                Text(
                    "Identity verification is separate from call reputation and can expire or become outdated.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            Text("Region: ${record.locationLabel ?: record.regionCode ?: "Unknown"}")
            Text("Number type: ${record.numberType ?: "Unknown"}")
            Text("Reputation: ${record.reputationLevel} (${record.reputationReports} reports)")
            Spacer(Modifier.height(4.dp))
            Text(record.locationDisclaimer, style = MaterialTheme.typography.bodySmall)
            if (record.evidence.isNotEmpty()) {
                Text("Evidence", style = MaterialTheme.typography.titleMedium)
                record.evidence.forEach { evidence ->
                    Text("${evidence.provider} · ${evidence.field} · ${(evidence.confidence * 100).toInt()}%")
                }
            }
            Spacer(Modifier.height(4.dp))
            Text("Community report", style = MaterialTheme.typography.titleMedium)
            visibleReportCategories.forEach { (category, label) ->
                TextButton(onClick = { onReport(category) }) { Text(label) }
            }
        }
    }
}
