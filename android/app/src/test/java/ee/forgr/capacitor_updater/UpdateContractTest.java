package ee.forgr.capacitor_updater;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import com.getcapacitor.PluginCall;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.security.MessageDigest;
import org.json.JSONArray;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** Exercises the actual installed plugin, not a permissive JavaScript stub. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, manifest = Config.NONE)
public class UpdateContractTest {
    private Probe plugin;
    private CapgoUpdater updater;
    private Method download;
    private static class Probe extends CapacitorUpdaterPlugin {
        int reloads = 0;
        @Override protected boolean _reload() { reloads++; return true; }
    }
    @Before public void setup() throws Exception {
        plugin = new Probe();
        updater = mock(CapgoUpdater.class);
        updater.publicKey = "";
        plugin.implementation = updater;
        Field logger = CapacitorUpdaterPlugin.class.getDeclaredField("logger");
        logger.setAccessible(true);
        logger.set(plugin, mock(Logger.class));
        download = CapacitorUpdaterPlugin.class.getDeclaredMethod("downloadBundle", String.class, String.class, String.class, String.class, JSONArray.class);
        download.setAccessible(true);
    }
    @Test public void missingChecksumIsRejectedBeforeNetwork() throws Exception {
        for (String checksum : new String[]{null, ""}) {
            try {
                download.invoke(plugin, "https://example.invalid/bundle.zip", "336.1", "", checksum, null);
                fail("Missing checksum must fail");
            } catch (InvocationTargetException e) {
                assertTrue(e.getCause() instanceof IOException);
                assertEquals("Checksum required", e.getCause().getMessage());
            }
        }
        verify(updater, never()).download(anyString(), anyString(), anyString(), anyString());
    }
    @Test public void checksumIsPassedUnchangedToNativeDownloader() throws Exception {
        String checksum = "8057b337a2ec0d4915853f4668883cda570f43499e3fdf17e0a64fe0e83a685a";
        BundleInfo bundle = mock(BundleInfo.class);
        when(updater.download("https://example.invalid/bundle.zip", "336.1", "", checksum)).thenReturn(bundle);
        assertSame(bundle, download.invoke(plugin, "https://example.invalid/bundle.zip", "336.1", "", checksum, null));
        verify(updater).download("https://example.invalid/bundle.zip", "336.1", "", checksum);
    }
    @Test public void pluginChecksumUsesLowercaseSha256() throws Exception {
        byte[] bytes = "Fractal Arena contract test".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String expected = java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        assertEquals(expected, CryptoCipher.calcChecksum(new ByteArrayInputStream(bytes)));
    }
    @Test public void nextSchedulesWithoutReloading() throws Exception {
        PluginCall call = mock(PluginCall.class);
        when(call.getString("id")).thenReturn("bundle-ready");
        when(updater.setNextBundle("bundle-ready")).thenReturn(true);
        when(updater.getBundleInfo("bundle-ready")).thenReturn(new BundleInfo("bundle-ready", "336.1", BundleStatus.PENDING, new java.util.Date(), "hash"));
        plugin.next(call);
        verify(updater).setNextBundle("bundle-ready");
        verify(updater, never()).set(anyString());
        assertEquals(0, plugin.reloads);
        verify(call).resolve(any(com.getcapacitor.JSObject.class));
    }
}
