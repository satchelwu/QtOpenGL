/*******************************************************************************
 * lighting/pointLight.frag
 *------------------------------------------------------------------------------
 * Apply the lighting calculation to a given fragment of incident light.
 * Uses GBuffer information to access statistics about the scene itself.
 ******************************************************************************/

#include <LightBuffer.ubo>
#include <GBuffer.ubo>
#include <Math.glsl> // saturate

uniform sampler2D shadowMap;

// Light Output
layout(location = 0) out highp vec4 fFragColor;

void main()
{
  // GBuffer Access
  highp vec3 viewPos  = viewPosition();
  highp vec3 normal   = normal();
  highp vec3 diffuse  = diffuse();
  highp vec4 specular = specular();

  // Light Information
  highp vec3  lightVec   = Light.ViewPosition - viewPos;
  highp float lightDist  = length(lightVec);

  // Construct a finite attenuation
  highp vec3  lightDir   = lightVec / lightDist;
  highp vec3  polynomial = vec3(1.0, lightDist, lightDist * lightDist);
  highp float attenuation = 1.0 / dot(polynomial,Light.Attenuation.xyz);
  attenuation *= saturate(1.0 - (lightDist / Light.Attenuation.w));

  // Blinn Phong
  highp float lambertian = max(dot(lightDir, normal), 0.0);
  highp vec3  viewDir    = normalize(-viewPos);
  highp vec3  halfDir    = normalize(lightDir + viewDir);
  highp float specAngle  = max(dot(halfDir, normal), 0.0);
  highp float specFactor = pow(specAngle, specular.w);

  // Spotlight Factor
  highp float spotAngle  = dot(-lightDir, Light.ViewDirection);
  highp float spotFactor = smoothstep(Light.OuterAngle, Light.InnerAngle, spotAngle);

  // Shadow Effect
  float bias = 0.005;
  float visibility = 1.0;
  mat4 biasMatrix = mat4(
    0.5, 0.0, 0.0, 0.0,
    0.0, 0.5, 0.0, 0.0,
    0.0, 0.0, 0.5, 0.0,
    0.5, 0.5, 0.5, 1.0
  );
  vec4 shadowCoord = biasMatrix * Light.ViewToLightPersp * vec4(viewPos, 1.0);
  if ( textureProj(shadowMap, shadowCoord.xyw).z < ((shadowCoord.z - bias) / shadowCoord.w))
  {
    visibility = 0.0;
  }

  // Construct Lighting Terms
  highp vec3 diffuseTerm  = Light.Diffuse  * diffuse      * lambertian;
  highp vec3 specularTerm = Light.Specular * specular.xyz * specFactor;
  fFragColor = vec4(visibility * spotFactor * attenuation * (diffuseTerm + specularTerm), 1.0);

  // Debug Drawing
  //fFragColor += debugExecution(spotFactor * attenuation);
}
