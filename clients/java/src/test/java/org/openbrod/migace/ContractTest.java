package org.openbrod.migace;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** Plays every case of the client contract in clients/contract/cases against a scripted database. M4.3-AC-07 */
class ContractTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    static Stream<Path> cases() throws IOException {
        try (Stream<Path> files = Files.list(Paths.get(System.getProperty("migace.contract.cases")))) {
            return files.filter(file -> file.toString().endsWith(".json")).sorted().collect(Collectors.toList()).stream();
        }
    }

    @Test
    void thereAreCases() throws IOException {
        assertTrue(cases().count() >= 20);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cases")
    void theLibraryPassesTheCase(Path file) throws IOException {
        JsonNode given = JSON.readTree(file.toFile());
        ScriptedDatabase database = new ScriptedDatabase();
        for (JsonNode answer : given.path("answers")) {
            ScriptedDatabase.Answer scripted = new ScriptedDatabase.Answer();
            for (JsonNode row : answer.path("rows")) {
                List<Object> values = new ArrayList<>();
                row.forEach(value -> values.add(value.isBoolean() ? (Object) value.booleanValue() : value.isNull() ? null : value.asText()));
                scripted.rows.add(values);
            }
            answer.path("notices").forEach(notice -> scripted.notices.add(notice.asText()));
            if (answer.has("error")) {
                scripted.errorCode = answer.path("error").path("code").asText();
                scripted.errorMessage = answer.path("error").path("message").asText();
            }
            database.answers.add(scripted);
        }
        List<String> notices = new ArrayList<>();
        String outcome = "success";
        MigrationFailedException failure = null;

        try {
            MigAce migration = MigAce.script(given.path("script").asText()).onNotice(notices::add);
            Iterator<Map.Entry<String, JsonNode>> parameters = given.path("parameters").fields();
            while (parameters.hasNext()) {
                Map.Entry<String, JsonNode> parameter = parameters.next();
                migration.parameter(parameter.getKey(), parameter.getValue().asText());
            }
            migration.exec(database.connection());
        } catch (MigrationFailedException e) {
            failure = e;
            outcome = e.isRefused() ? "refused" : "failure";
        }

        JsonNode expected = given.path("expected");
        assertEquals(expected.path("outcome").asText(), outcome);
        assertEquals(texts(expected.path("sent")), database.sent);
        assertEquals(texts(expected.path("notices")), notices);
        JsonNode error = expected.path("error");
        if (error.has("message")) {
            assertNotNull(failure);
            assertEquals(error.path("message").asText(), failure.getMessage());
        }
        if (error.has("code")) {
            assertEquals(error.path("code").asText(), failure.getSqlState());
        }
        for (JsonNode text : error.path("mentions")) {
            assertTrue(failure.getMessage().contains(text.asText()), failure.getMessage() + " does not mention " + text.asText());
        }
    }

    private static List<String> texts(JsonNode list) {
        List<String> texts = new ArrayList<>();
        list.forEach(text -> texts.add(text.asText()));
        return texts;
    }
}
