package org.openbrod.migace;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLFeatureNotSupportedException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.logging.Handler;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

class MigAceTest {

    private static final String SCRIPT = "-- @migace script format=1\n-- @migace statement\nselect 1\n-- @migace statement\nselect 2\n";

    private static DataSource dataSourceOf(ScriptedDatabase database) {
        return new DataSource() {
            @Override public Connection getConnection() { return database.connection(); }
            @Override public Connection getConnection(String user, String password) { return database.connection(); }
            @Override public PrintWriter getLogWriter() { return null; }
            @Override public void setLogWriter(PrintWriter out) { }
            @Override public void setLoginTimeout(int seconds) { }
            @Override public int getLoginTimeout() { return 0; }
            @Override public Logger getParentLogger() throws SQLFeatureNotSupportedException { throw new SQLFeatureNotSupportedException(); }
            @Override public <T> T unwrap(Class<T> type) throws SQLException { throw new SQLException(); }
            @Override public boolean isWrapperFor(Class<?> type) { return false; }
        };
    }

    // M4.3-AC-08
    @Test
    void oneCallReadsTheScriptFromAResourceOfTheJarAndRunsItOnADataSource() {
        ScriptedDatabase database = new ScriptedDatabase();

        MigAce.execFromJar(MigAceTest.class, "/migace/test-script.sql", dataSourceOf(database));

        assertEquals(Arrays.asList("select 1"), database.sent);
    }

    @Test
    void oneCallReadsTheScriptFromAResourceOfTheJarAndRunsItOnAConnection() {
        ScriptedDatabase database = new ScriptedDatabase();

        MigAce.execFromJar(MigAceTest.class, "/migace/test-script.sql", database.connection());

        assertEquals(Arrays.asList("select 1"), database.sent);
    }

    @Test
    void aResourceThatIsNotThereIsAFailureThatNamesIt() {
        MigrationFailedException failure = assertThrows(MigrationFailedException.class,
            () -> MigAce.fromJar(MigAceTest.class, "/migace/missing.sql"));

        assertEquals("No migration script at the resource \"/migace/missing.sql\" of the JAR of org.openbrod.migace.MigAceTest.", failure.getMessage());
    }

    // M4.3-AC-09
    @Test
    void aConnectionOfTheCallerIsSwitchedToAutocommitGivenBackWithItsEarlierSettingAndNotClosed() {
        ScriptedDatabase database = new ScriptedDatabase();
        database.autoCommit = false;

        MigAce.script(SCRIPT).exec(database.connection());

        assertEquals(Arrays.asList("autocommit true", "send in autocommit true", "send in autocommit true", "autocommit false"), database.log);
        assertFalse(database.closed);
    }

    @Test
    void theEarlierSettingIsGivenBackAfterAFailureToo() {
        ScriptedDatabase database = new ScriptedDatabase();
        database.autoCommit = false;
        ScriptedDatabase.Answer failing = new ScriptedDatabase.Answer();
        failing.errorMessage = "boom";
        failing.errorCode = "P0001";
        database.answers.add(failing);

        assertThrows(MigrationFailedException.class, () -> MigAce.script(SCRIPT).exec(database.connection()));

        assertFalse(database.autoCommit);
        assertFalse(database.closed);
    }

    // M4.4-AC-10
    @Test
    void aPoolOfOneConnectionGetsItBackAfterTheLastStatementsRanAlsoAfterAFailureAndTheNextRunUsesIt() {
        String withFinally = "-- @migace script format=1\n-- @migace statement\nselect broken()\n-- @migace statement\nselect 2\n"
            + "-- @migace finally\n-- @migace statement\nselect 'clean up'\n";
        ScriptedDatabase database = new ScriptedDatabase();
        ScriptedDatabase.Answer failing = new ScriptedDatabase.Answer();
        failing.errorMessage = "function broken() does not exist";
        failing.errorCode = "42883";
        database.answers.add(failing);
        DataSource pool = dataSourceOf(database);

        MigrationFailedException failure = assertThrows(MigrationFailedException.class, () -> MigAce.script(withFinally).exec(pool));
        assertEquals("function broken() does not exist", failure.getMessage());
        assertEquals(Arrays.asList("select broken()", "select 'clean up'"), database.sent);
        assertEquals("close", database.log.get(database.log.size() - 1));

        database.closed = false;
        MigAce.script(withFinally).exec(pool);

        assertEquals(Arrays.asList("select broken()", "select 'clean up'", "select broken()", "select 2", "select 'clean up'"), database.sent);
        assertTrue(database.closed);
    }

    @Test
    void aConnectionTakenFromADataSourceIsClosed() {
        ScriptedDatabase database = new ScriptedDatabase();

        MigAce.script(SCRIPT).exec(dataSourceOf(database));

        assertTrue(database.closed);
        assertEquals(2, database.sent.size());
    }

    // M4.3-AC-10
    @Test
    void noticesReachTheListenerOfTheCaller() {
        ScriptedDatabase database = new ScriptedDatabase();
        ScriptedDatabase.Answer first = new ScriptedDatabase.Answer();
        first.notices.addAll(Arrays.asList("part a: done", "part b: skipped"));
        database.answers.add(first);
        List<String> notices = new ArrayList<>();

        MigAce.script(SCRIPT).onNotice(notices::add).exec(database.connection());

        assertEquals(Arrays.asList("part a: done", "part b: skipped"), notices);
    }

    @Test
    void withoutAListenerNoticesGoToTheLoggingOfTheJdk() {
        ScriptedDatabase database = new ScriptedDatabase();
        ScriptedDatabase.Answer first = new ScriptedDatabase.Answer();
        first.notices.add("part a: done");
        database.answers.add(first);
        List<String> logged = new ArrayList<>();
        Handler handler = new Handler() {
            @Override public void publish(LogRecord record) { logged.add(record.getLevel() + " " + record.getMessage()); }
            @Override public void flush() { }
            @Override public void close() { }
        };
        Logger logger = Logger.getLogger(MigAce.class.getName());
        logger.addHandler(handler);
        try {
            MigAce.script(SCRIPT).exec(database.connection());
        } finally {
            logger.removeHandler(handler);
        }

        assertEquals(Arrays.asList("INFO part a: done"), logged);
    }

    // M4.3-AC-11
    @Test
    void aFailureIsOneExceptionWithTheMessageOfTheScriptTheCodeOfTheDatabaseAndTheOriginalExceptionAsItsCause() {
        ScriptedDatabase database = new ScriptedDatabase();
        database.answers.add(new ScriptedDatabase.Answer());
        ScriptedDatabase.Answer failing = new ScriptedDatabase.Answer();
        failing.errorMessage = "20260302-0900-a, part p: division by zero";
        failing.errorCode = "22012";
        database.answers.add(failing);

        MigrationFailedException failure = assertThrows(MigrationFailedException.class, () -> MigAce.script(SCRIPT).exec(database.connection()));

        assertEquals("20260302-0900-a, part p: division by zero", failure.getMessage());
        assertEquals("22012", failure.getSqlState());
        assertTrue(failure.getCause() instanceof SQLException);
        assertSame(MigrationFailedException.class, failure.getClass());
        assertFalse(failure.isRefused());
    }

    @Test
    void aParameterNeedsAPlainName() {
        MigrationFailedException failure = assertThrows(MigrationFailedException.class, () -> MigAce.script(SCRIPT).parameter("x', 'y", "1"));

        assertTrue(failure.getMessage().startsWith("The name of a parameter is made of letters, digits and underscores"));
    }

    @Test
    void parametersAndAListenerCanBeChained() {
        ScriptedDatabase database = new ScriptedDatabase();
        List<String> notices = new ArrayList<>();

        MigAce.script(SCRIPT).parameter("schema", "shop").parameter("lock_wait", "2s").onNotice(notices::add).exec(database.connection());

        assertEquals(Arrays.asList("select set_config('migace.schema', 'shop', false)", "select set_config('migace.lock_wait', '2s', false)", "select 1", "select 2"), database.sent);
    }
}
