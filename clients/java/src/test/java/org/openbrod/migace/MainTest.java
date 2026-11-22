package org.openbrod.migace;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MainTest {

    /** A JDBC driver for addresses that start with jdbc:scripted: . It answers from a scripted database, or refuses the connection. */
    static final class ScriptedDriver implements Driver {
        ScriptedDatabase database = new ScriptedDatabase();
        Properties properties;
        boolean refuse;

        @Override public Connection connect(String url, Properties info) throws SQLException {
            if (!acceptsURL(url)) {
                return null;
            }
            properties = info;
            if (refuse) {
                // A real driver may repeat the address and the properties in its message.
                throw new SQLException("Cannot connect to " + url + " with password=" + info.getProperty("password"), "08001");
            }
            return database.connection();
        }
        @Override public boolean acceptsURL(String url) { return url.startsWith("jdbc:scripted:"); }
        @Override public DriverPropertyInfo[] getPropertyInfo(String url, Properties info) { return new DriverPropertyInfo[0]; }
        @Override public int getMajorVersion() { return 1; }
        @Override public int getMinorVersion() { return 0; }
        @Override public boolean jdbcCompliant() { return false; }
        @Override public Logger getParentLogger() { return Logger.getGlobal(); }
    }

    @TempDir
    Path folder;

    private final ScriptedDriver driver = new ScriptedDriver();
    private final ByteArrayOutputStream out = new ByteArrayOutputStream();
    private final ByteArrayOutputStream err = new ByteArrayOutputStream();
    private Path script;

    @BeforeEach
    void registerTheDriver() throws SQLException, IOException {
        DriverManager.registerDriver(driver);
        script = folder.resolve("migration-script-pg.sql");
        Files.write(script, "-- @migace script format=1\n-- @migace statement\nselect 1\n".getBytes(StandardCharsets.UTF_8));
    }

    @AfterEach
    void removeTheDriver() throws SQLException {
        DriverManager.deregisterDriver(driver);
    }

    private int run(Map<String, String> environment, String... args) {
        return Main.run(args, environment, new PrintStream(out, true), new PrintStream(err, true), null);
    }

    private String output() {
        return new String(out.toByteArray(), StandardCharsets.UTF_8) + new String(err.toByteArray(), StandardCharsets.UTF_8);
    }

    // M4.3-AC-12
    @Test
    void itRunsTheScriptAndEndsWithTheCodeZero() {
        ScriptedDatabase.Answer first = new ScriptedDatabase.Answer();
        driver.database.answers.add(new ScriptedDatabase.Answer());
        first.notices.add("20260302-0900-a, part p: done");
        driver.database.answers.add(first);

        int code = run(Collections.emptyMap(), "--url", "jdbc:scripted:shop", "--user", "owner", "--schema", "shop", script.toString());

        assertEquals(0, code);
        assertEquals(Arrays.asList("select set_config('migace.schema', 'shop', false)", "select 1"), driver.database.sent);
        assertEquals("owner", driver.properties.getProperty("user"));
        assertTrue(output().contains("20260302-0900-a, part p: done"));
    }

    @Test
    void otherParametersOfTheRunAreOptions() {
        run(Collections.emptyMap(), "--url", "jdbc:scripted:shop", "--user", "owner", "--param", "lock_timeout=2s", "--param", "lock_attempts=5", script.toString());

        assertEquals(Arrays.asList("select set_config('migace.lock_timeout', '2s', false)", "select set_config('migace.lock_attempts', '5', false)", "select 1"),
            driver.database.sent);
    }

    @Test
    void aFailureOfTheMigrationEndsWithAnotherCodeAndItsMessage() {
        ScriptedDatabase.Answer failing = new ScriptedDatabase.Answer();
        failing.errorMessage = "20260302-0900-a, part p: division by zero";
        failing.errorCode = "P0001";
        driver.database.answers.add(failing);

        int code = run(Collections.emptyMap(), "--url", "jdbc:scripted:shop", "--user", "owner", script.toString());

        assertEquals(1, code);
        assertTrue(output().contains("20260302-0900-a, part p: division by zero"));
    }

    @Test
    void aCallWithoutTheAddressTheUserOrTheScriptEndsWithTheCodeTwoAndSaysHowToCallIt() {
        String[][] calls = {
            {"--user", "owner", script.toString()},
            {"--url", "jdbc:scripted:shop", script.toString()},
            {"--url", "jdbc:scripted:shop", "--user", "owner"},
        };
        for (String[] call : calls) {
            err.reset();

            assertEquals(2, run(Collections.emptyMap(), call));

            assertTrue(output().startsWith("Usage: java -cp migace-runner.jar"), output());
            assertTrue(driver.database.sent.isEmpty());
        }
    }

    @Test
    void anUnknownOptionIsNamed() {
        assertEquals(2, run(Collections.emptyMap(), "--url", "jdbc:scripted:shop", "--user", "owner", "--fast", script.toString()));

        assertTrue(output().startsWith("Unknown or incomplete option: --fast" + System.lineSeparator() + "Usage: java"), output());
    }

    @Test
    void anOptionWithoutItsValueIsNamed() {
        assertEquals(2, run(Collections.emptyMap(), script.toString(), "--user", "owner", "--url"));

        assertTrue(output().startsWith("Unknown or incomplete option: --url"), output());
    }

    @Test
    void aSecondScriptFileIsRefused() {
        assertEquals(2, run(Collections.emptyMap(), "--url", "jdbc:scripted:shop", "--user", "owner", script.toString(), "other.sql"));

        assertTrue(output().startsWith("Unknown or incomplete option: a second script file"), output());
        assertTrue(driver.database.sent.isEmpty());
    }

    @Test
    void aScriptFileThatCannotBeReadIsNamed() {
        Path missing = folder.resolve("missing.sql");

        assertEquals(2, run(Collections.emptyMap(), "--url", "jdbc:scripted:shop", "--user", "owner", missing.toString()));

        assertTrue(output().startsWith("The script file \"" + missing + "\" cannot be read: "), output());
    }

    // M4.3-AC-13
    @Test
    void thePasswordComesFromTheEnvironmentVariable() {
        Map<String, String> environment = new HashMap<>();
        environment.put("MIGACE_PASSWORD", "s3cret");

        run(environment, "--url", "jdbc:scripted:shop", "--user", "owner", script.toString());

        assertEquals("s3cret", driver.properties.getProperty("password"));
    }

    @Test
    void withoutTheVariableThePasswordIsAskedFor() {
        int code = Main.run(new String[] {"--url", "jdbc:scripted:shop", "--user", "owner", script.toString()},
            Collections.emptyMap(), new PrintStream(out, true), new PrintStream(err, true), () -> "typed");

        assertEquals(0, code);
        assertEquals("typed", driver.properties.getProperty("password"));
    }

    @Test
    void thereIsNoOptionForThePassword() {
        int code = run(Collections.emptyMap(), "--url", "jdbc:scripted:shop", "--user", "owner", "--password", "s3cret", script.toString());

        assertEquals(2, code);
        assertFalse(output().contains("s3cret"));
    }

    // M4.3-AC-14
    @Test
    void noSecretAppearsInAnyOutput() {
        driver.refuse = true;
        Map<String, String> environment = new HashMap<>();
        environment.put("MIGACE_PASSWORD", "s3cret-from-env");

        int code = run(environment, "--url", "jdbc:scripted://owner:in-the-address@db.example/shop?password=also-in-the-address&ssl=true", "--user", "owner", script.toString());

        assertEquals(1, code);
        String output = output();
        assertTrue(output.contains("No connection to the database"), output);
        assertFalse(output.contains("s3cret-from-env"), output);
        assertFalse(output.contains("in-the-address"), output);
        assertFalse(output.contains("also-in-the-address"), output);
        assertTrue(output.contains("db.example/shop"), output);
    }

    @Test
    void aFailureOfTheMigrationThatRepeatsThePasswordIsPrintedWithoutIt() {
        ScriptedDatabase.Answer failing = new ScriptedDatabase.Answer();
        failing.errorMessage = "20260302-0900-a, part p: could not log in with s3cret";
        failing.errorCode = "P0001";
        driver.database.answers.add(failing);
        Map<String, String> environment = new HashMap<>();
        environment.put("MIGACE_PASSWORD", "s3cret");

        run(environment, "--url", "jdbc:scripted:shop", "--user", "owner", script.toString());

        assertFalse(output().contains("s3cret"));
        assertTrue(output().contains("could not log in with ***"));
    }
}
